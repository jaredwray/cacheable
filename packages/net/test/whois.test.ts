import net, { type AddressInfo } from "node:net";
import { Cacheable } from "cacheable";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
	CacheableNet,
	detectQueryType,
	normalizeWhoisQuery,
	parseWhois,
	queryWhoisServer,
	whois,
	whoisRaw,
} from "../src/index.js";

/** Every server started during the suite, closed in afterAll. */
const allServers: net.Server[] = [];
/** Every accepted socket, destroyed in afterAll so close() never hangs. */
const allSockets: net.Socket[] = [];

/** Start a raw TCP server on an ephemeral loopback port. */
function startServer(
	onConnection: (socket: net.Socket) => void,
): Promise<{ server: net.Server; port: number }> {
	return new Promise((resolve) => {
		const server = net.createServer(onConnection);
		server.on("connection", (socket) => allSockets.push(socket));
		allServers.push(server);
		server.listen(0, "127.0.0.1", () => {
			resolve({ server, port: (server.address() as AddressInfo).port });
		});
	});
}

type Fake = {
	port: number;
	state: { connections: number; lastRaw: string };
};

/**
 * Start a fake WHOIS server that replies with the string returned by `respond`.
 * Returning undefined leaves the connection open (to exercise timeouts).
 */
async function startFakeWhois(
	respond: (query: string) => string | undefined,
): Promise<Fake> {
	const state = { connections: 0, lastRaw: "" };
	const { port } = await startServer((socket) => {
		state.connections += 1;
		let buffer = "";
		socket.on("data", (chunk: Buffer) => {
			buffer += chunk.toString("utf8");
			if (buffer.includes("\n")) {
				state.lastRaw = buffer;
				const response = respond(buffer.split(/\r?\n/)[0]);
				if (response !== undefined) {
					socket.end(response);
				}
			}
		});
	});
	return { port, state };
}

let iana: Fake;
let registry: Fake;
let registrar: Fake;
let chain1: Fake;
let chain2: Fake;
let chain3: Fake;
let loopA: Fake;
let loopB: Fake;
let counter: Fake;
let silent: Fake;
let noRefer: Fake;
let badRefer: Fake;
let noPortRefer: Fake;
let capture: Fake;
let idnPort: number;

beforeAll(async () => {
	registrar = await startFakeWhois((query) =>
		[
			`Domain Name: ${query}`,
			"Registrar: Test Registrar",
			"Name Server: ns3.registrar.test",
			"Name Server: ns4.registrar.test",
			"Registrar Abuse Contact Email: abuse@registrar.test",
			"",
		].join("\n"),
	);

	registry = await startFakeWhois((query) =>
		[
			"% IANA-style comment",
			">>> disclaimer line <<<",
			"# hash comment",
			"* star comment",
			`Domain Name: ${query}`,
			"Registry Domain ID: 12345",
			"Name Server: ns1.registry.test",
			"Name Server: ns2.registry.test",
			`Registrar WHOIS Server: 127.0.0.1:${registrar.port}`,
			`Registrar WHOIS Server: 127.0.0.1:${registrar.port}`,
			"URL: http://www.registry.test",
			"novalue:",
			": nokey",
			"NoColonLineHere",
			"",
		].join("\n"),
	);

	iana = await startFakeWhois((query) =>
		[
			"% IANA",
			`refer: 127.0.0.1:${registry.port}`,
			`domain: ${query}`,
			"",
		].join("\n"),
	);

	chain3 = await startFakeWhois((query) =>
		[`Domain Name: ${query}`, "Result: deep", ""].join("\n"),
	);
	chain2 = await startFakeWhois((query) =>
		[
			`Domain Name: ${query}`,
			`Registrar WHOIS Server: 127.0.0.1:${chain3.port}`,
			"",
		].join("\n"),
	);
	chain1 = await startFakeWhois((query) =>
		[
			`Domain Name: ${query}`,
			`Registrar WHOIS Server: 127.0.0.1:${chain2.port}`,
			"",
		].join("\n"),
	);

	loopA = await startFakeWhois((query) =>
		[
			`Domain Name: ${query}`,
			`Registrar WHOIS Server: 127.0.0.1:${loopB.port}`,
			"",
		].join("\n"),
	);
	loopB = await startFakeWhois((query) =>
		[
			`Domain Name: ${query}`,
			`Registrar WHOIS Server: 127.0.0.1:${loopA.port}`,
			"",
		].join("\n"),
	);

	counter = await startFakeWhois((query) =>
		[`Domain Name: ${query}`, "Status: ok", ""].join("\n"),
	);

	silent = await startFakeWhois(() => undefined);

	noRefer = await startFakeWhois((query) =>
		["% iana", `domain: ${query}`, ""].join("\n"),
	);
	badRefer = await startFakeWhois(() => "refer: whois://\n");
	noPortRefer = await startFakeWhois((query) =>
		[
			`Domain Name: ${query}`,
			"Registrar WHOIS Server: nonexistent.invalid",
			"",
		].join("\n"),
	);

	capture = await startFakeWhois(() => "Received: ok\n");

	const idn = await startServer((socket) => {
		socket.on("data", () => {
			const payload = Buffer.from("Domain Name: café.test\n", "utf8");
			const splitAt = payload.indexOf(0xc3) + 1;
			socket.write(payload.subarray(0, splitAt));
			setImmediate(() => {
				socket.write(payload.subarray(splitAt));
				socket.end();
			});
		});
	});
	idnPort = idn.port;
});

afterAll(async () => {
	for (const socket of allSockets) {
		socket.destroy();
	}
	await Promise.all(
		allServers.map(
			(server) =>
				new Promise<void>((resolve) => {
					server.close(() => resolve());
				}),
		),
	);
});

describe("queryWhoisServer", () => {
	test("connects and returns the raw response", async () => {
		const raw = await queryWhoisServer({
			host: "127.0.0.1",
			port: counter.port,
			query: "x.test",
		});
		expect(raw).toContain("Domain Name: x.test");
	});

	test("writes the query with prefix and CRLF", async () => {
		await queryWhoisServer({
			host: "127.0.0.1",
			port: capture.port,
			query: "example.com",
			queryPrefix: "domain ",
		});
		expect(capture.state.lastRaw).toBe("domain example.com\r\n");
	});

	test("rejects on timeout", async () => {
		await expect(
			queryWhoisServer({
				host: "127.0.0.1",
				port: silent.port,
				query: "x",
				timeout: 150,
			}),
		).rejects.toThrow(/timed out/);
	});

	test("rejects when the connection is refused", async () => {
		const temp = net.createServer();
		await new Promise<void>((resolve) => {
			temp.listen(0, "127.0.0.1", () => resolve());
		});
		const closedPort = (temp.address() as AddressInfo).port;
		await new Promise<void>((resolve) => temp.close(() => resolve()));

		await expect(
			queryWhoisServer({
				host: "127.0.0.1",
				port: closedPort,
				query: "x",
				timeout: 2000,
			}),
		).rejects.toThrow();
	});

	test("decodes multi-byte responses split across chunks", async () => {
		const raw = await queryWhoisServer({
			host: "127.0.0.1",
			port: idnPort,
			query: "x",
		});
		expect(raw).toContain("café.test");
	});

	test("defaults to the WHOIS port when none is given", async () => {
		// Nothing listens on port 43 here, so this exercises the default-port path
		// and rejects (connection refused or timeout).
		await expect(
			queryWhoisServer({ host: "127.0.0.1", query: "x", timeout: 1000 }),
		).rejects.toThrow();
	});
});

describe("normalizeWhoisQuery", () => {
	test.each([
		["https://www.Example.COM/path?q=1#h", "example.com"],
		["HTTP://Example.com/", "example.com"],
		["whois://host.test", "host.test"],
		["  example.com.  ", "example.com"],
		["example.com", "example.com"],
		["español.com", "xn--espaol-zwa.com"],
		["8.8.8.8", "8.8.8.8"],
		["AS15169", "as15169"],
	])("normalizes %s -> %s", (input, expected) => {
		expect(normalizeWhoisQuery(input)).toBe(expected);
	});

	test("keeps the original value when the IDN is invalid", () => {
		expect(normalizeWhoisQuery("￿")).toBe("￿");
	});
});

describe("detectQueryType", () => {
	test.each([
		["example.com", "domain"],
		["8.8.8.8", "ipv4"],
		["2001:db8::1", "ipv6"],
		["as15169", "asn"],
		["AS15169", "asn"],
	])("detects %s as %s", (input, expected) => {
		expect(detectQueryType(input)).toBe(expected);
	});
});

describe("parseWhois", () => {
	test("parses fields, ignoring comments and grouping repeats", () => {
		const raw = [
			"% comment",
			"# hash",
			">>> disclaimer",
			"* star",
			"Domain Name: example.com",
			"Name Server: ns1.example.com",
			"Name Server: ns2.example.com",
			"Name Server: ns3.example.com",
			"URL: http://example.com/path",
			"emptyval:",
			": emptykey",
			"NoColonLine",
			"",
		].join("\r\n");

		const fields = parseWhois(raw);
		expect(fields["Domain Name"]).toBe("example.com");
		expect(fields["Name Server"]).toEqual([
			"ns1.example.com",
			"ns2.example.com",
			"ns3.example.com",
		]);
		expect(fields.URL).toBe("http://example.com/path");
		expect(fields.emptyval).toBeUndefined();
		expect(fields.NoColonLine).toBeUndefined();
	});
});

describe("whois lookups", () => {
	test("looks up via an explicit server without following", async () => {
		const result = await whois("example.test", {
			server: "127.0.0.1",
			port: registry.port,
			follow: false,
		});
		expect(result.type).toBe("domain");
		expect(result.hops).toHaveLength(1);
		expect(result.server).toBe("127.0.0.1");
		expect(result.fields["Name Server"]).toEqual([
			"ns1.registry.test",
			"ns2.registry.test",
		]);
		expect(result.fields["Registrar Abuse Contact Email"]).toBeUndefined();
		expect(result.raw).toContain("Domain Name: example.test");
	});

	test("follows registry -> registrar referrals by default", async () => {
		const result = await whois("example.test", {
			server: "127.0.0.1",
			port: registry.port,
		});
		expect(result.hops).toHaveLength(2);
		expect(result.hops[0].port).toBe(registry.port);
		expect(result.hops[1].port).toBe(registrar.port);
		expect(result.fields["Registry Domain ID"]).toBe("12345");
		expect(result.fields["Registrar Abuse Contact Email"]).toBe(
			"abuse@registrar.test",
		);
		expect(result.fields["Name Server"]).toEqual([
			"ns1.registry.test",
			"ns2.registry.test",
			"ns3.registrar.test",
			"ns4.registrar.test",
		]);
		expect(result.fields["Domain Name"]).toEqual([
			"example.test",
			"example.test",
		]);
		expect(result.raw).toContain("Registrar: Test Registrar");
	});

	test("caps following at the requested referral depth", async () => {
		const result = await whois("c1.test", {
			server: "127.0.0.1",
			port: chain1.port,
			follow: 1,
		});
		expect(result.hops).toHaveLength(2);
		expect(chain3.state.connections).toBe(0);
	});

	test("follows multiple referrals when depth allows", async () => {
		const result = await whois("c1.test", {
			server: "127.0.0.1",
			port: chain1.port,
			follow: 2,
		});
		expect(result.hops).toHaveLength(3);
		expect(result.fields.Result).toBe("deep");
	});

	test("stops on a referral loop", async () => {
		const result = await whois("loop.test", {
			server: "127.0.0.1",
			port: loopA.port,
			follow: 5,
		});
		expect(result.hops).toHaveLength(2);
		expect(loopA.state.connections).toBeGreaterThanOrEqual(1);
		expect(loopB.state.connections).toBeGreaterThanOrEqual(1);
	});

	test("bootstraps via IANA when no server is given", async () => {
		const result = await whois("example.test", {
			bootstrapServer: "127.0.0.1",
			bootstrapPort: iana.port,
		});
		expect(result.hops).toHaveLength(2);
		expect(result.fields["Registry Domain ID"]).toBe("12345");
		expect(result.fields["Registrar Abuse Contact Email"]).toBe(
			"abuse@registrar.test",
		);
	});

	test("throws when IANA returns no referral", async () => {
		await expect(
			whois("x.test", {
				bootstrapServer: "127.0.0.1",
				bootstrapPort: noRefer.port,
			}),
		).rejects.toThrow(/No WHOIS server found/);
	});

	test("throws when the IANA referral is unparseable", async () => {
		await expect(
			whois("x.test", {
				bootstrapServer: "127.0.0.1",
				bootstrapPort: badRefer.port,
			}),
		).rejects.toThrow(/No WHOIS server found/);
	});

	test("rejects when a referral host is unreachable", async () => {
		await expect(
			whois("x.test", {
				server: "127.0.0.1",
				port: noPortRefer.port,
				follow: 1,
				timeout: 2000,
			}),
		).rejects.toThrow();
	});

	test("defaults the server port when only a host is given", async () => {
		// No port -> defaults to 43, where nothing listens, so this rejects.
		await expect(
			whois("x.test", { server: "127.0.0.1", follow: false, timeout: 1000 }),
		).rejects.toThrow();
	});

	test("defaults the bootstrap port when only a bootstrap host is given", async () => {
		await expect(
			whois("x.test", { bootstrapServer: "127.0.0.1", timeout: 1000 }),
		).rejects.toThrow();
	});
});

describe("whois caching", () => {
	test("caches results and serves repeats from cache", async () => {
		const cache = new Cacheable();
		const result1 = await whois("counted.test", {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
			cache,
		});
		const after = counter.state.connections;
		const result2 = await whois("counted.test", {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
			cache,
		});
		expect(counter.state.connections).toBe(after);
		expect(result2).toEqual(result1);
	});

	test("coalesces concurrent identical lookups", async () => {
		const cache = new Cacheable();
		const before = counter.state.connections;
		await Promise.all([
			whois("coalesce.test", {
				server: "127.0.0.1",
				port: counter.port,
				follow: false,
				cache,
			}),
			whois("coalesce.test", {
				server: "127.0.0.1",
				port: counter.port,
				follow: false,
				cache,
			}),
		]);
		expect(counter.state.connections - before).toBe(1);
	});

	test("does not cache when caching is disabled", async () => {
		const cache = new Cacheable();
		const before = counter.state.connections;
		const options = {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
			caching: false,
			cache,
		};
		await whois("nocache.test", options);
		await whois("nocache.test", options);
		expect(counter.state.connections - before).toBe(2);
	});

	test("does not cache without a cache instance", async () => {
		const before = counter.state.connections;
		const options = {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
		};
		await whois("free.test", options);
		await whois("free.test", options);
		expect(counter.state.connections - before).toBe(2);
	});

	test("reuses the cached server mapping to skip IANA", async () => {
		const cache = new Cacheable();
		const before = iana.state.connections;
		await whois("first.test", {
			bootstrapServer: "127.0.0.1",
			bootstrapPort: iana.port,
			follow: false,
			cache,
		});
		await whois("second.test", {
			bootstrapServer: "127.0.0.1",
			bootstrapPort: iana.port,
			follow: false,
			cache,
		});
		expect(iana.state.connections - before).toBe(1);
	});

	test("caches the server mapping for IP queries", async () => {
		const cache = new Cacheable();
		const result = await whois("8.8.8.8", {
			bootstrapServer: "127.0.0.1",
			bootstrapPort: iana.port,
			follow: false,
			cache,
		});
		expect(result.type).toBe("ipv4");
		expect(await cache.get("whois:server:ipv4:8.8.8.8")).toBeDefined();
	});

	test("does not cache failed lookups", async () => {
		const cache = new Cacheable();
		const before = silent.state.connections;
		const options = {
			server: "127.0.0.1",
			port: silent.port,
			follow: false,
			timeout: 150,
			cache,
		};
		await expect(whois("err.test", options)).rejects.toThrow();
		await expect(whois("err.test", options)).rejects.toThrow();
		expect(silent.state.connections - before).toBe(2);
	});
});

describe("whoisRaw", () => {
	test("returns only the raw text", async () => {
		const raw = await whoisRaw("counted.test", {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
		});
		expect(typeof raw).toBe("string");
		expect(raw).toContain("Domain Name: counted.test");
	});
});

describe("CacheableNet.whois", () => {
	test("uses the instance cache for repeat lookups", async () => {
		const instance = new CacheableNet();
		const before = counter.state.connections;
		await instance.whois("inst.test", {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
		});
		const mid = counter.state.connections;
		await instance.whois("inst.test", {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
		});
		expect(mid - before).toBe(1);
		expect(counter.state.connections).toBe(mid);
	});

	test("bypasses the cache when caching is false", async () => {
		const instance = new CacheableNet();
		const before = counter.state.connections;
		const options = {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
			caching: false,
		};
		await instance.whois("instnc.test", options);
		await instance.whois("instnc.test", options);
		expect(counter.state.connections - before).toBe(2);
	});
});

describe("whois query types", () => {
	test("detects IPv4 queries", async () => {
		const result = await whois("8.8.8.8", {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
		});
		expect(result.type).toBe("ipv4");
	});

	test("detects ASN queries", async () => {
		const result = await whois("AS15169", {
			server: "127.0.0.1",
			port: counter.port,
			follow: false,
		});
		expect(result.type).toBe("asn");
	});
});
