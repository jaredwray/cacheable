import { createConnection, isIPv4, isIPv6 } from "node:net";
import { domainToASCII } from "node:url";
import { coalesceAsync } from "@cacheable/utils";
import type { Cacheable } from "cacheable";

/**
 * The default WHOIS port as defined by RFC 3912.
 */
const WHOIS_PORT = 43;

/**
 * The IANA WHOIS server used to bootstrap discovery of the authoritative
 * registry / RIR server for any domain, IP address, or ASN.
 */
const IANA_WHOIS_SERVER = "whois.iana.org";

/**
 * The default socket timeout in milliseconds.
 */
const DEFAULT_TIMEOUT = 10_000;

/**
 * The default number of registry → registrar referral hops to follow.
 */
const DEFAULT_FOLLOW_DEPTH = 2;

/**
 * Line prefixes that mark a comment / disclaimer in WHOIS output and should be
 * skipped when parsing key/value fields (IANA `%`, ICANN `>>>`, etc.).
 */
const COMMENT_PREFIXES = ["%", "#", ">>>", "*"];

/**
 * Field names (case-insensitive) that carry a referral to another WHOIS server,
 * in priority order. The first one present in a response is followed.
 */
const REFERRAL_KEYS = [
	"refer",
	"whois",
	"registrar whois server",
	"referralserver",
];

/**
 * The detected category of a WHOIS query.
 */
export type WhoisQueryType = "domain" | "ipv4" | "ipv6" | "asn";

/**
 * A resolved WHOIS server reference (host and port).
 */
type ServerRef = { host: string; port: number };

/**
 * Parsed WHOIS fields. Repeated keys (e.g. multiple `Name Server` lines) are
 * grouped into an array; single occurrences remain a string.
 */
export type WhoisFields = Record<string, string | string[]>;

/**
 * A single server response collected while resolving a WHOIS query. When
 * referrals are followed there will be one hop per server queried.
 */
export type WhoisHop = {
	/** The server queried for this hop. */
	server: string;
	/** The TCP port used for this hop. */
	port: number;
	/** The raw text returned by this server. */
	raw: string;
	/** The parsed key/value fields for this hop. */
	fields: WhoisFields;
};

/**
 * The result of a WHOIS lookup, exposing both the raw text and parsed JSON.
 */
export type WhoisResult = {
	/** The normalized query that was looked up. */
	query: string;
	/** The detected type of the query. */
	type: WhoisQueryType;
	/** The final authoritative server that produced the primary data. */
	server: string;
	/** The raw text across all hops, separated by a blank line. */
	raw: string;
	/** The merged parsed fields across all hops (repeats become arrays). */
	fields: WhoisFields;
	/** Every server response, in the order they were queried. */
	hops: WhoisHop[];
};

/**
 * Options for {@link queryWhoisServer}.
 */
export type QueryWhoisServerOptions = {
	/** The server hostname or IP to connect to. */
	host: string;
	/** The TCP port to connect to. @default 43 */
	port?: number;
	/** The query string written to the socket. */
	query: string;
	/** An optional prefix written before the query (e.g. `"domain "`). @default "" */
	queryPrefix?: string;
	/** Milliseconds before the socket is destroyed and the call rejects. @default 10000 */
	timeout?: number;
	/** The encoding used to decode the response. @default "utf8" */
	encoding?: BufferEncoding;
};

/**
 * Options for {@link whois} and {@link whoisRaw}.
 */
export type WhoisOptions = {
	/**
	 * Override the WHOIS server to query first. When set, the IANA bootstrap
	 * step is skipped and this server is queried directly.
	 */
	server?: string;
	/** The TCP port to use for the initial server. @default 43 */
	port?: number;
	/** The socket timeout in milliseconds. @default 10000 */
	timeout?: number;
	/**
	 * Whether to follow registry → registrar referrals.
	 * - `false` / `0`: do not follow (authoritative server only)
	 * - `true`: follow up to the default depth (2)
	 * - `number`: follow up to N referral hops
	 * @default true
	 */
	follow?: boolean | number;
	/** An optional prefix written before the query (e.g. `"domain "`). @default "" */
	queryPrefix?: string;
	/** The encoding used to decode responses. @default "utf8" */
	encoding?: BufferEncoding;
	/** The bootstrap WHOIS server used when no `server` is provided. @default "whois.iana.org" */
	bootstrapServer?: string;
	/** The TCP port of the bootstrap WHOIS server. @default 43 */
	bootstrapPort?: number;
	/**
	 * Enable or disable caching for this lookup. When `false`, no caching is
	 * performed even if a cache is available. @default true (when a cache is available)
	 */
	caching?: boolean;
	/** The cache instance. The standalone {@link whois} caches only when this is provided. */
	cache?: Cacheable;
	/** An optional TTL override for cached results (milliseconds or shorthand). */
	ttl?: number | string;
};

/**
 * Open a raw WHOIS connection to a single server on TCP port 43, write the
 * query, and resolve with the full text response. This is the low-level
 * primitive used by {@link whois}; host and port are explicit so it can be
 * pointed at any server (including a local test server).
 *
 * @param {QueryWhoisServerOptions} options The connection and query options.
 * @returns {Promise<string>} The raw text returned by the server.
 */
export function queryWhoisServer(
	options: QueryWhoisServerOptions,
): Promise<string> {
	const {
		host,
		port = WHOIS_PORT,
		query,
		queryPrefix = "",
		timeout = DEFAULT_TIMEOUT,
		encoding = "utf8",
	} = options;

	return new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let settled = false;

		const socket = createConnection({ host, port });
		socket.setTimeout(timeout);

		// Settle exactly once. Timeout/error/close can all fire for one socket, so
		// the guard prevents a double resolve/reject (and an unhandled rejection).
		const settle = (finish: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			socket.destroy();
			finish();
		};

		socket.on("connect", () => {
			socket.write(`${queryPrefix}${query}\r\n`);
		});

		socket.on("data", (chunk: Buffer) => {
			chunks.push(chunk);
		});

		socket.on("timeout", () => {
			settle(() =>
				reject(
					new Error(
						`WHOIS query to ${host}:${port} timed out after ${timeout}ms`,
					),
				),
			);
		});

		socket.on("error", (error: Error) => {
			settle(() => reject(error));
		});

		socket.on("close", () => {
			settle(() => resolve(Buffer.concat(chunks).toString(encoding)));
		});
	});
}

/**
 * Normalize a WHOIS query by stripping URL scheme, `www.`, path/query/hash, and
 * trailing dots, lowercasing, and converting internationalized domains to
 * punycode.
 *
 * @param {string} input The raw query (domain, URL, IP, or ASN).
 * @returns {string} The normalized query.
 */
export function normalizeWhoisQuery(input: string): string {
	let value = input.trim().toLowerCase();
	// Strip a leading scheme such as http://, https://, or whois://.
	value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
	// Strip a leading www. prefix.
	value = value.replace(/^www\./, "");
	// Cut everything from the first path, query, or hash separator.
	value = value.split(/[/?#]/)[0];
	// Strip trailing dots (FQDN root) and surrounding whitespace.
	value = value.replace(/\.+$/, "").trim();

	// Convert internationalized domain names to punycode. domainToASCII returns
	// "" for invalid input, so fall back to the cleaned value when that happens.
	const hasNonAscii = [...value].some((char) => char.charCodeAt(0) > 127);
	if (hasNonAscii) {
		const ascii = domainToASCII(value);
		if (ascii !== "") {
			value = ascii;
		}
	}

	return value;
}

/**
 * Detect whether a normalized query is a domain, IPv4 address, IPv6 address, or
 * autonomous system number.
 *
 * @param {string} value The normalized query.
 * @returns {WhoisQueryType} The detected query type.
 */
export function detectQueryType(value: string): WhoisQueryType {
	if (/^as\d+$/i.test(value)) {
		return "asn";
	}
	if (isIPv4(value)) {
		return "ipv4";
	}
	if (isIPv6(value)) {
		return "ipv6";
	}
	return "domain";
}

/**
 * Parse raw WHOIS text into a key/value object. Comment and disclaimer lines are
 * ignored, and repeated keys are grouped into arrays.
 *
 * @param {string} raw The raw WHOIS text.
 * @returns {WhoisFields} The parsed fields.
 */
export function parseWhois(raw: string): WhoisFields {
	const fields: WhoisFields = {};

	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed === "") {
			continue;
		}
		if (COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
			continue;
		}

		const index = trimmed.indexOf(":");
		if (index === -1) {
			continue;
		}

		const key = trimmed.slice(0, index).trim();
		const value = trimmed.slice(index + 1).trim();
		if (key === "" || value === "") {
			continue;
		}

		const existing = fields[key];
		if (existing === undefined) {
			fields[key] = value;
		} else if (Array.isArray(existing)) {
			existing.push(value);
		} else {
			fields[key] = [existing, value];
		}
	}

	return fields;
}

/**
 * Look up a field by name, ignoring case, returning the first value.
 */
function getFieldCaseInsensitive(
	fields: WhoisFields,
	name: string,
): string | undefined {
	const lower = name.toLowerCase();
	for (const [key, value] of Object.entries(fields)) {
		if (key.toLowerCase() === lower) {
			return Array.isArray(value) ? value[0] : value;
		}
	}
	return undefined;
}

/**
 * Parse a referral value (e.g. `whois.example.com`, `whois://host:43`) into a
 * host and port.
 */
function parseReferralValue(value: string): ServerRef | undefined {
	// Strip a scheme such as whois:// or rwhois:// and any trailing path.
	const cleaned = value
		.trim()
		.replace(/^[a-z]+:\/\//i, "")
		.split(/[/\s]/)[0];

	const [host, portString] = cleaned.split(":");
	if (host === "") {
		return undefined;
	}

	const port =
		portString === undefined ? WHOIS_PORT : Number.parseInt(portString, 10);
	return { host, port };
}

/**
 * Extract the first referral server from a parsed response, if any.
 */
function extractReferral(fields: WhoisFields): ServerRef | undefined {
	for (const key of REFERRAL_KEYS) {
		const value = getFieldCaseInsensitive(fields, key);
		if (value !== undefined) {
			return parseReferralValue(value);
		}
	}
	return undefined;
}

/**
 * Merge the fields of one hop into an accumulator, grouping repeated keys into
 * arrays so no data is lost across hops.
 */
function mergeFields(target: WhoisFields, source: WhoisFields): void {
	for (const [key, value] of Object.entries(source)) {
		const existing = target[key];
		if (existing === undefined) {
			target[key] = value;
			continue;
		}

		const base = Array.isArray(existing) ? existing : [existing];
		const incoming = Array.isArray(value) ? value : [value];
		target[key] = [...base, ...incoming];
	}
}

/**
 * Resolve the configured follow option into a concrete referral depth.
 */
function resolveFollowDepth(follow: WhoisOptions["follow"]): number {
	if (follow === undefined || follow === true) {
		return DEFAULT_FOLLOW_DEPTH;
	}
	if (follow === false) {
		return 0;
	}
	return follow;
}

/**
 * Build the cache key used to remember which server is authoritative for a query.
 */
function serverCacheKey(normalized: string, type: WhoisQueryType): string {
	if (type === "domain") {
		const tld = normalized.slice(normalized.lastIndexOf(".") + 1);
		return `whois:server:${tld}`;
	}
	return `whois:server:${type}:${normalized}`;
}

/**
 * Resolve the first server to query for a normalized query, using (in order) an
 * explicit override, the cached mapping, or a live IANA bootstrap lookup.
 */
async function resolveBootstrapServer(
	normalized: string,
	type: WhoisQueryType,
	options: WhoisOptions,
): Promise<ServerRef> {
	if (options.server !== undefined) {
		return { host: options.server, port: options.port ?? WHOIS_PORT };
	}

	const cache = options.cache;
	const key = serverCacheKey(normalized, type);

	if (cache) {
		const cached = await cache.get<ServerRef>(key);
		if (cached) {
			return cached;
		}
	}

	const ianaRaw = await queryWhoisServer({
		/* v8 ignore next -- @preserve the real IANA host is only used off the test harness */
		host: options.bootstrapServer ?? IANA_WHOIS_SERVER,
		port: options.bootstrapPort ?? WHOIS_PORT,
		query: normalized,
		timeout: options.timeout,
		encoding: options.encoding,
	});

	const refer = getFieldCaseInsensitive(parseWhois(ianaRaw), "refer");
	const referral = refer === undefined ? undefined : parseReferralValue(refer);
	if (referral === undefined) {
		throw new Error(`No WHOIS server found for "${normalized}" via IANA`);
	}

	if (cache) {
		await cache.set(key, referral);
	}

	return referral;
}

/**
 * Run the full WHOIS pipeline: resolve the authoritative server, query it,
 * follow referrals up to the configured depth, and combine the results.
 */
async function runWhois(
	normalized: string,
	type: WhoisQueryType,
	options: WhoisOptions,
): Promise<WhoisResult> {
	let remaining = resolveFollowDepth(options.follow);
	const visited = new Set<string>();
	const hops: WhoisHop[] = [];

	let next: ServerRef | undefined = await resolveBootstrapServer(
		normalized,
		type,
		options,
	);

	while (next !== undefined) {
		const id = `${next.host.toLowerCase()}:${next.port}`;
		if (visited.has(id)) {
			break;
		}
		visited.add(id);

		const raw = await queryWhoisServer({
			host: next.host,
			port: next.port,
			query: normalized,
			queryPrefix: options.queryPrefix,
			timeout: options.timeout,
			encoding: options.encoding,
		});
		const fields = parseWhois(raw);
		hops.push({ server: next.host, port: next.port, raw, fields });

		if (remaining <= 0) {
			break;
		}

		const referral = extractReferral(fields);
		if (referral === undefined) {
			break;
		}

		remaining -= 1;
		next = referral;
	}

	const mergedFields: WhoisFields = {};
	for (const hop of hops) {
		mergeFields(mergedFields, hop.fields);
	}

	return {
		query: normalized,
		type,
		server: hops[hops.length - 1].server,
		raw: hops.map((hop) => hop.raw).join("\n\n"),
		fields: mergedFields,
		hops,
	};
}

/**
 * Perform a WHOIS lookup for a domain, IP address, or ASN and return both the
 * raw text and parsed JSON fields. The authoritative server is discovered
 * dynamically through IANA (and cached), and registry → registrar referrals are
 * followed by default. When a cache is provided, results are cached and
 * concurrent identical lookups are coalesced.
 *
 * @param {string} query The domain, URL, IP address, or ASN to look up.
 * @param {WhoisOptions} options Optional lookup options.
 * @returns {Promise<WhoisResult>} The raw text and parsed fields.
 */
export async function whois(
	query: string,
	options: WhoisOptions = {},
): Promise<WhoisResult> {
	const normalized = normalizeWhoisQuery(query);
	const type = detectQueryType(normalized);
	const cache = options.caching === false ? undefined : options.cache;
	const effectiveOptions: WhoisOptions = { ...options, cache };

	if (!cache) {
		return runWhois(normalized, type, effectiveOptions);
	}

	const followDepth = resolveFollowDepth(options.follow);
	const cacheKey = `whois:${normalized}:f${followDepth}`;

	return coalesceAsync(`net:${cacheKey}`, async () => {
		const existing = await cache.get<WhoisResult>(cacheKey);
		if (existing) {
			return existing;
		}

		const result = await runWhois(normalized, type, effectiveOptions);
		await cache.set(cacheKey, result, options.ttl);
		return result;
	});
}

/**
 * Perform a WHOIS lookup and return only the raw text response.
 *
 * @param {string} query The domain, URL, IP address, or ASN to look up.
 * @param {WhoisOptions} options Optional lookup options.
 * @returns {Promise<string>} The raw WHOIS text.
 */
export async function whoisRaw(
	query: string,
	options?: WhoisOptions,
): Promise<string> {
	const result = await whois(query, options);
	return result.raw;
}
