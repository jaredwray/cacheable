import process from "node:process";
import { faker } from "@faker-js/faker";
import { Cacheable } from "cacheable";
import { describe, expect, test } from "vitest";
import {
	CacheableNet,
	type CacheableNetOptions,
	type FetchOptions,
	fetch,
	get,
	Net,
	post,
} from "../src/index.js";

const testUrl = process.env.TEST_URL ?? "https://mockhttp.org";
const testTimeout = 10_000; // 10 seconds

describe("Cacheable Net", () => {
	test("should create an instance of CacheableNet", () => {
		const net = new CacheableNet();
		expect(net).toBeInstanceOf(CacheableNet);
	});

	test("should create an instance of Net", () => {
		const net = new Net();
		expect(net).toBeInstanceOf(CacheableNet);
	});

	test("should create an instance with cache instance", async () => {
		const cacheOptions: CacheableNetOptions = {
			cache: new Cacheable({ ttl: "1h" }),
		};
		const net = new CacheableNet(cacheOptions);
		expect(net.cache).toBeInstanceOf(Cacheable);
		expect(net.cache.ttl).toBe("1h");

		// Do a quick test to ensure the cache is working
		const data = { key: faker.string.uuid(), value: faker.string.alpha(10) };
		await net.cache.set(data.key, data.value);
		const cachedValue = await net.cache.get(data.key);
		expect(cachedValue).toBe(data.value);
	});

	test("should create an instance with custom cache options", () => {
		const cacheOptions: CacheableNetOptions = {
			cache: {
				ttl: "2h",
			},
		};
		const net = new Net(cacheOptions);
		expect(net.cache).toBeInstanceOf(Cacheable);
		expect(net.cache.ttl).toBe("2h");

		// Set a new cache instance
		const newCache = new Cacheable({ ttl: "3h" });
		net.cache = newCache;
		expect(net.cache).toBe(newCache);
	});

	test("should fetch data using fetch method", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/get`;
		const options: FetchOptions = {
			method: "GET",
			cache,
		};
		const response = await fetch(url, options);
		expect(response).toBeDefined();
	});

	test(
		"should fetch data using CacheableNet fetch method",
		async () => {
			const net = new Net();
			const url = `${testUrl}/get`;
			const options = {
				method: "GET",
			};
			const response = await net.fetch(url, options);
			expect(response).toBeDefined();
		},
		testTimeout,
	);

	test(
		"should fetch data using CacheableNet get method",
		async () => {
			const net = new Net();
			const url = `${testUrl}/get`;
			const result = await net.get(url);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using standalone get function",
		async () => {
			const url = `${testUrl}/get`;
			const options = {
				cache: new Cacheable(),
			};
			const result = await get(url, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch typed data using get with generics",
		async () => {
			interface TestData {
				method: string;
				url: string;
			}
			const net = new Net();
			const url = `${testUrl}/get`;
			const result = await net.get<TestData>(url);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			// TypeScript will ensure result.data has the TestData type
			if (typeof result.data === "object" && result.data !== null) {
				expect(result.data).toHaveProperty("method");
			}
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in CacheableNet get method",
		async () => {
			const net = new Net();
			// Use a URL that returns plain text
			const mockTextUrl = "https://httpbin.org/robots.txt";
			const result = await net.get(mockTextUrl);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(typeof result.data).toBe("string");
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using CacheableNet post method",
		async () => {
			const net = new Net();
			const url = `${testUrl}/post`;
			const options = {
				body: JSON.stringify({ test: "data" }),
				headers: {
					"Content-Type": "application/json",
				},
			};
			const result = await net.post(url, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using standalone post function",
		async () => {
			const url = `${testUrl}/post`;
			const options = {
				cache: new Cacheable(),
				body: JSON.stringify({ test: "data" }),
				headers: {
					"Content-Type": "application/json",
				},
			};
			const result = await post(url, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in CacheableNet post method",
		async () => {
			const net = new Net();
			// Use httpbin's status endpoint that returns non-JSON
			const url = "https://httpbin.org/status/201";
			const options = {
				body: "test data",
			};
			const result = await net.post(url, options);
			expect(result).toBeDefined();
			// Status endpoint returns empty body
			expect(result.data).toBe("");
			expect(typeof result.data).toBe("string");
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(201);
		},
		testTimeout,
	);

	test(
		"should fetch typed data using post with generics",
		async () => {
			interface PostResponse {
				method: string;
				data: string;
			}
			const net = new Net();
			const url = `${testUrl}/post`;
			const result = await net.post<PostResponse>(url, {
				body: JSON.stringify({ test: "data" }),
				headers: {
					"Content-Type": "application/json",
				},
			});
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			// TypeScript will ensure result.data has the PostResponse type
			if (typeof result.data === "object" && result.data !== null) {
				expect(result.data).toHaveProperty("method");
			}
		},
		testTimeout,
	);
});
