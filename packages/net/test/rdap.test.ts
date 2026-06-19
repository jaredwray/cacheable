import http from "node:http";
import type { AddressInfo } from "node:net";
import { Cacheable } from "cacheable";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { CacheableNet, rdap } from "../src/index.js";

let server: http.Server;
let origin = "";
let bootstrapUrl = "";
const requests: string[] = [];
const authByPath = new Map<string, string | undefined>();

/** Count how many times a given path has been requested. */
function countRequests(path: string): number {
	return requests.filter((url) => url === path).length;
}

function sendJson(
	res: http.ServerResponse,
	status: number,
	body: unknown,
): void {
	res.writeHead(status, { "content-type": "application/rdap+json" });
	res.end(JSON.stringify(body));
}

beforeAll(async () => {
	server = http.createServer((req, res) => {
		const url = req.url ?? "/";
		requests.push(url);
		authByPath.set(url, req.headers.authorization);
		const rdapBase = `${origin}/rdap-server/`;
		const other = "https://unused.example/rdap/";

		if (url === "/rdap/dns.json") {
			sendJson(res, 200, {
				services: [
					[["example"], [other]],
					[["test"], [rdapBase]],
				],
			});
			return;
		}
		if (url === "/rdap/ipv4.json") {
			sendJson(res, 200, {
				services: [
					[["10.0.0.0/8", "127.0.0.0"], [other]],
					[["1.0.0.0/8"], [rdapBase]],
				],
			});
			return;
		}
		if (url === "/rdap/ipv6.json") {
			sendJson(res, 200, {
				services: [
					[["2001:db8::/32"], [rdapBase]],
					[["::/0"], [rdapBase]],
				],
			});
			return;
		}
		if (url === "/rdap/asn.json") {
			sendJson(res, 200, {
				services: [
					[["1-100"], [other]],
					[["15169"], [rdapBase]],
				],
			});
			return;
		}
		if (url === "/rdap-server/domain/missing.test") {
			sendJson(res, 404, { errorCode: 404 });
			return;
		}
		if (url === "/rdap-server/domain/bad.test") {
			res.writeHead(200, { "content-type": "application/rdap+json" });
			res.end("this is not json");
			return;
		}
		if (url.startsWith("/rdap-server/domain/")) {
			sendJson(res, 200, {
				objectClassName: "domain",
				ldhName: url.slice("/rdap-server/domain/".length),
			});
			return;
		}
		if (url.startsWith("/rdap-server/ip/")) {
			sendJson(res, 200, { objectClassName: "ip network", handle: "NET-TEST" });
			return;
		}
		if (url.startsWith("/rdap-server/autnum/")) {
			sendJson(res, 200, {
				objectClassName: "autnum",
				handle: url.slice("/rdap-server/autnum/".length),
			});
			return;
		}

		res.writeHead(404);
		res.end("not found");
	});

	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", () => resolve());
	});
	const { port } = server.address() as AddressInfo;
	origin = `http://127.0.0.1:${port}`;
	bootstrapUrl = `${origin}/rdap`;
});

afterAll(async () => {
	await new Promise<void>((resolve) => {
		server.closeAllConnections();
		server.close(() => resolve());
	});
});

describe("rdap lookups", () => {
	test("looks up a domain through the bootstrap registry", async () => {
		const result = await rdap("foo.test", { bootstrapUrl });
		expect(result.query).toBe("foo.test");
		expect(result.type).toBe("domain");
		expect(result.server).toBe(`${origin}/rdap-server/`);
		expect(result.data.objectClassName).toBe("domain");
		expect(result.data.ldhName).toBe("foo.test");
		expect(result.raw).toContain("domain");
	});

	test("throws when the TLD is not in the bootstrap registry", async () => {
		await expect(rdap("foo.unknown", { bootstrapUrl })).rejects.toThrow(
			/No RDAP server found/,
		);
	});

	test("throws when the bootstrap registry cannot be fetched", async () => {
		await expect(
			rdap("foo.test", { bootstrapUrl: `${origin}/missing-bootstrap` }),
		).rejects.toThrow(/Failed to fetch RDAP bootstrap/);
	});

	test("uses an explicit server (without a trailing slash) and skips the bootstrap", async () => {
		const before = countRequests("/rdap/dns.json");
		const result = await rdap("skip.test", {
			server: `${origin}/rdap-server`,
		});
		expect(result.data.objectClassName).toBe("domain");
		expect(countRequests("/rdap/dns.json")).toBe(before);
	});

	test("accepts a bootstrap URL with a trailing slash", async () => {
		const result = await rdap("slash.test", {
			bootstrapUrl: `${bootstrapUrl}/`,
		});
		expect(result.data.objectClassName).toBe("domain");
		expect(result.data.ldhName).toBe("slash.test");
	});

	test("looks up an IPv4 address", async () => {
		const result = await rdap("1.2.3.4", { bootstrapUrl });
		expect(result.type).toBe("ipv4");
		expect(result.data.objectClassName).toBe("ip network");
		expect(countRequests("/rdap-server/ip/1.2.3.4")).toBe(1);
	});

	test("looks up an IPv6 address (full form)", async () => {
		const result = await rdap("2001:0db8:0000:0000:0000:0000:0000:0009", {
			bootstrapUrl,
		});
		expect(result.type).toBe("ipv6");
		expect(result.data.objectClassName).toBe("ip network");
	});

	test("looks up an IPv6 address (compressed form)", async () => {
		const result = await rdap("::1234", { bootstrapUrl });
		expect(result.type).toBe("ipv6");
		expect(result.data.objectClassName).toBe("ip network");
	});

	test("looks up an ASN", async () => {
		const result = await rdap("AS15169", { bootstrapUrl });
		expect(result.type).toBe("asn");
		expect(result.data.handle).toBe("15169");
		expect(countRequests("/rdap-server/autnum/15169")).toBe(1);
	});

	test("throws when the RDAP query returns a non-ok status", async () => {
		await expect(rdap("missing.test", { bootstrapUrl })).rejects.toThrow(
			/status 404/,
		);
	});

	test("throws when the RDAP response is not valid JSON", async () => {
		await expect(rdap("bad.test", { bootstrapUrl })).rejects.toThrow(
			/not valid JSON/,
		);
	});
});

describe("rdap caching", () => {
	test("caches results and serves repeats from cache", async () => {
		const cache = new Cacheable();
		await rdap("cache.test", { bootstrapUrl, cache });
		await rdap("cache.test", { bootstrapUrl, cache });
		expect(countRequests("/rdap-server/domain/cache.test")).toBe(1);
	});

	test("coalesces concurrent identical lookups", async () => {
		const cache = new Cacheable();
		await Promise.all([
			rdap("coal.test", { bootstrapUrl, cache }),
			rdap("coal.test", { bootstrapUrl, cache }),
		]);
		expect(countRequests("/rdap-server/domain/coal.test")).toBe(1);
	});

	test("does not cache when caching is disabled", async () => {
		const cache = new Cacheable();
		await rdap("nc.test", { bootstrapUrl, cache, caching: false });
		await rdap("nc.test", { bootstrapUrl, cache, caching: false });
		expect(countRequests("/rdap-server/domain/nc.test")).toBe(2);
	});

	test("does not cache without a cache instance", async () => {
		await rdap("free.test", { bootstrapUrl });
		await rdap("free.test", { bootstrapUrl });
		expect(countRequests("/rdap-server/domain/free.test")).toBe(2);
	});

	test("varies the cache key by server/bootstrap so endpoints are not confused", async () => {
		const cache = new Cacheable();
		await rdap("keyed.test", { bootstrapUrl, cache });
		await rdap("keyed.test", { server: `${origin}/rdap-server`, cache });
		expect(countRequests("/rdap-server/domain/keyed.test")).toBe(2);
	});
});

describe("rdap headers", () => {
	test("does not forward caller headers to the bootstrap registry", async () => {
		await rdap("hdr.test", {
			bootstrapUrl,
			headers: { authorization: "secret" },
		});
		expect(authByPath.get("/rdap/dns.json")).toBeUndefined();
		expect(authByPath.get("/rdap-server/domain/hdr.test")).toBe("secret");
	});
});

describe("CacheableNet.rdap", () => {
	test("uses the instance cache for repeat lookups", async () => {
		const instance = new CacheableNet();
		await instance.rdap("inst.test", { bootstrapUrl });
		await instance.rdap("inst.test", { bootstrapUrl });
		expect(countRequests("/rdap-server/domain/inst.test")).toBe(1);
	});

	test("bypasses the cache when caching is false", async () => {
		const instance = new CacheableNet();
		await instance.rdap("instnc.test", { bootstrapUrl, caching: false });
		await instance.rdap("instnc.test", { bootstrapUrl, caching: false });
		expect(countRequests("/rdap-server/domain/instnc.test")).toBe(2);
	});
});
