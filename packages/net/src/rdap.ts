import { coalesceAsync } from "@cacheable/utils";
import type { Cacheable } from "cacheable";
import { type FetchOptions, fetch } from "./fetch.js";
import {
	detectQueryType,
	normalizeWhoisQuery,
	type WhoisQueryType,
} from "./whois.js";

/**
 * The base URL of the IANA RDAP bootstrap registries.
 * @see https://data.iana.org/rdap/
 */
const IANA_RDAP_BOOTSTRAP = "https://data.iana.org/rdap";

/**
 * The shape of an IANA RDAP bootstrap registry file. Each service maps a list of
 * keys (TLDs, CIDR ranges, or ASN ranges) to a list of RDAP base URLs.
 * @see https://www.rfc-editor.org/rfc/rfc9224
 */
type RdapBootstrap = {
	services: Array<[string[], string[]]>;
};

/**
 * The result of an RDAP lookup, exposing both the raw JSON text and the parsed
 * object.
 */
export type RdapResult = {
	/** The normalized query that was looked up. */
	query: string;
	/** The detected type of the query. */
	type: WhoisQueryType;
	/** The RDAP base URL that produced the data. */
	server: string;
	/** The raw JSON text returned by the server. */
	raw: string;
	/** The parsed RDAP object. */
	data: Record<string, unknown>;
};

/**
 * Options for {@link rdap}.
 */
export type RdapOptions = {
	/**
	 * Override the RDAP base URL to query. When set, the IANA bootstrap step is
	 * skipped and this server is queried directly.
	 */
	server?: string;
	/** Override the IANA bootstrap base URL. @default "https://data.iana.org/rdap" */
	bootstrapUrl?: string;
	/** Additional request headers to send with the RDAP request. */
	headers?: Record<string, string>;
	/**
	 * Enable or disable caching for this lookup. When `false`, no caching is
	 * performed even if a cache is available. @default true (when a cache is available)
	 */
	caching?: boolean;
	/** The cache instance. The standalone {@link rdap} caches only when this is provided. */
	cache?: Cacheable;
	/** An optional TTL override for cached results (milliseconds or shorthand). */
	ttl?: number | string;
};

/**
 * Remove a trailing slash from a URL, if present.
 */
function trimTrailingSlash(url: string): string {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Ensure a URL ends with a single trailing slash.
 */
function ensureTrailingSlash(url: string): string {
	return url.endsWith("/") ? url : `${url}/`;
}

/**
 * Map a query type to the IANA RDAP bootstrap registry file name.
 */
function bootstrapFileForType(type: WhoisQueryType): string {
	switch (type) {
		case "ipv4":
			return "ipv4.json";
		case "ipv6":
			return "ipv6.json";
		case "asn":
			return "asn.json";
		default:
			return "dns.json";
	}
}

/**
 * Map a query type to the RDAP path segment used to look it up.
 */
function rdapPathForType(type: WhoisQueryType): string {
	switch (type) {
		case "ipv4":
		case "ipv6":
			return "ip";
		case "asn":
			return "autnum";
		default:
			return "domain";
	}
}

/**
 * Build the fetch options used for RDAP requests, including the cache instance
 * when caching is enabled.
 */
function buildFetchOptions(
	headers: Record<string, string> | undefined,
	cache: Cacheable | undefined,
): FetchOptions {
	const fetchOptions: FetchOptions = {
		headers: { accept: "application/rdap+json", ...headers },
		// Bootstrap files and RDAP responses are cached by key regardless of the
		// server's HTTP cache directives, matching the explicit result caching.
		httpCachePolicy: false,
	};
	if (cache) {
		fetchOptions.cache = cache;
	}
	return fetchOptions;
}

/**
 * Convert an IPv6 address (including `::` compression) to a BigInt.
 */
function ipv6ToBigInt(ip: string): bigint {
	const [head, tail] = ip.split("::");
	const headParts = head ? head.split(":") : [];
	const tailParts = tail ? tail.split(":") : [];
	// Clamp so a malformed address with more than 8 groups never yields a
	// negative length (which would make Array() throw a RangeError).
	const missing = Math.max(0, 8 - headParts.length - tailParts.length);
	const parts = [...headParts, ...Array(missing).fill("0"), ...tailParts];
	return parts.reduce(
		(accumulator, part) =>
			(accumulator << 16n) + BigInt(Number.parseInt(part, 16)),
		0n,
	);
}

/**
 * Convert an IP address to a BigInt for range comparison.
 */
function ipToBigInt(ip: string, type: WhoisQueryType): bigint {
	if (type === "ipv4") {
		return ip
			.split(".")
			.reduce(
				(accumulator, part) => (accumulator << 8n) + BigInt(Number(part)),
				0n,
			);
	}
	return ipv6ToBigInt(ip);
}

/**
 * Determine whether an IP address falls within a CIDR block.
 */
function ipInCidr(ip: string, cidr: string, type: WhoisQueryType): boolean {
	const [network, prefixString] = cidr.split("/");
	const bits = type === "ipv4" ? 32 : 128;
	const prefix = prefixString ? Number.parseInt(prefixString, 10) : bits;
	const shift = BigInt(bits - prefix);
	return ipToBigInt(ip, type) >> shift === ipToBigInt(network, type) >> shift;
}

/**
 * Determine whether an ASN falls within an IANA bootstrap range (e.g. `36864-37887`).
 */
function asnInRange(asn: number, range: string): boolean {
	const [startString, endString] = range.split("-");
	const start = Number.parseInt(startString, 10);
	const end = endString ? Number.parseInt(endString, 10) : start;
	return asn >= start && asn <= end;
}

/**
 * Determine whether a bootstrap service's keys match the query.
 */
function matchesService(
	type: WhoisQueryType,
	normalized: string,
	keys: string[],
): boolean {
	if (type === "domain") {
		const tld = normalized.slice(normalized.lastIndexOf(".") + 1);
		return keys.some((key) => key.toLowerCase() === tld);
	}
	if (type === "asn") {
		const asn = Number.parseInt(normalized.replace(/^as/i, ""), 10);
		return keys.some((range) => asnInRange(asn, range));
	}
	return keys.some((cidr) => ipInCidr(normalized, cidr, type));
}

/**
 * Find the RDAP base URL for a query within a bootstrap registry. The first URL
 * advertised for the matching service is used (IANA lists the preferred HTTPS
 * endpoint first).
 */
function findRdapBase(
	bootstrap: RdapBootstrap,
	type: WhoisQueryType,
	normalized: string,
): string | undefined {
	for (const [keys, urls] of bootstrap.services) {
		if (matchesService(type, normalized, keys)) {
			return urls[0];
		}
	}
	return undefined;
}

/**
 * Resolve the RDAP base URL for a query, using an explicit override or a (cached)
 * IANA bootstrap lookup.
 */
async function resolveRdapBase(
	normalized: string,
	type: WhoisQueryType,
	options: RdapOptions,
	cache: Cacheable | undefined,
): Promise<string> {
	if (options.server !== undefined) {
		return options.server;
	}

	/* v8 ignore next -- @preserve the real IANA default is only used off the test harness */
	const base = trimTrailingSlash(options.bootstrapUrl ?? IANA_RDAP_BOOTSTRAP);
	const url = `${base}/${bootstrapFileForType(type)}`;
	// Do not forward caller headers (e.g. Authorization for a registry) to the
	// public IANA bootstrap endpoint.
	const response = await fetch(url, buildFetchOptions(undefined, cache));
	if (!response.ok) {
		throw new Error(
			`Failed to fetch RDAP bootstrap from ${url}: ${response.status} ${response.statusText}`,
		);
	}
	const bootstrap = JSON.parse(await response.text()) as RdapBootstrap;

	const rdapBase = findRdapBase(bootstrap, type, normalized);
	if (rdapBase === undefined) {
		throw new Error(`No RDAP server found for "${normalized}"`);
	}
	return rdapBase;
}

/**
 * Run the full RDAP pipeline: resolve the base URL, query the endpoint, and parse
 * the JSON response.
 */
async function runRdap(
	normalized: string,
	type: WhoisQueryType,
	options: RdapOptions,
	cache: Cacheable | undefined,
): Promise<RdapResult> {
	const base = await resolveRdapBase(normalized, type, options, cache);
	const key = type === "asn" ? normalized.replace(/^as/i, "") : normalized;
	const url = `${ensureTrailingSlash(base)}${rdapPathForType(type)}/${key}`;

	// The RDAP result is cached at the rdap:<query> level with the requested TTL,
	// so the final query is not cached again at the fetch layer (which would
	// persist a GET:<url> entry that can outlive and bypass that TTL).
	const response = await fetch(
		url,
		buildFetchOptions(options.headers, undefined),
	);
	const raw = await response.text();
	if (!response.ok) {
		throw new Error(
			`RDAP query for "${normalized}" failed with status ${response.status}`,
		);
	}

	let data: Record<string, unknown>;
	try {
		data = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		throw new Error(`RDAP response for "${normalized}" was not valid JSON`);
	}

	return { query: normalized, type, server: base, raw, data };
}

/**
 * Perform an RDAP lookup for a domain, IP address, or ASN and return both the raw
 * JSON text and the parsed object. The RDAP server is discovered dynamically
 * through the IANA bootstrap registries (fetched through the package's cached
 * fetch). When a cache is provided, results are cached and concurrent identical
 * lookups are coalesced.
 *
 * @param {string} query The domain, URL, IP address, or ASN to look up.
 * @param {RdapOptions} options Optional lookup options.
 * @returns {Promise<RdapResult>} The raw JSON text and parsed data.
 */
export async function rdap(
	query: string,
	options: RdapOptions = {},
): Promise<RdapResult> {
	const normalized = normalizeWhoisQuery(query);
	const type = detectQueryType(normalized);
	const cache = options.caching === false ? undefined : options.cache;

	if (!cache) {
		return runRdap(normalized, type, options, undefined);
	}

	// Include every option that changes the result so a lookup against one
	// server/bootstrap/headers never serves a cache hit meant for another.
	const cacheKey = `rdap:${normalized}:${JSON.stringify({
		server: options.server,
		bootstrapUrl: options.bootstrapUrl,
		headers: options.headers,
	})}`;

	return coalesceAsync(`net:${cacheKey}`, async () => {
		const existing = await cache.get<RdapResult>(cacheKey);
		if (existing) {
			return existing;
		}

		const result = await runRdap(normalized, type, options, cache);
		await cache.set(cacheKey, result, options.ttl);
		return result;
	});
}
