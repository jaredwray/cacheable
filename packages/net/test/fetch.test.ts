import process from "node:process";
import { Cacheable } from "cacheable";
import { describe, expect, test } from "vitest";
import { type FetchOptions, fetch, get } from "../src/fetch.js";

const testUrl = process.env.TEST_URL ?? "https://mockhttp.org";
const testTimeout = 10_000; // 10 seconds

describe("Fetch", () => {
	test(
		"should fetch data successfully",
		async () => {
			const url = `${testUrl}/get`;
			const options: FetchOptions = {
				method: "GET",
				cache: new Cacheable(),
			};
			const response = await fetch(url, options);
			expect(response).toBeDefined();
		},
		testTimeout,
	);

	test(
		"should fetch data without method (defaults to GET)",
		async () => {
			const url = `${testUrl}/get`;
			const cache = new Cacheable({ stats: true });
			const options: FetchOptions = {
				cache,
			} as FetchOptions;
			const response = await fetch(url, options);
			expect(response).toBeDefined();
			// Make second request to verify caching with default GET method
			const response2 = await fetch(url, options);
			expect(response2).toBeDefined();
			expect(cache.stats.hits).toBe(1);
		},
		testTimeout,
	);

	test(
		"should fetch data successfully from cache",
		async () => {
			const cache = new Cacheable({ stats: true });
			const url = `${testUrl}/get`;
			const options: FetchOptions = {
				method: "GET",
				cache,
			};
			const response = await fetch(url, options);
			const response2 = await fetch(url, options);
			expect(response).toBeDefined();
			expect(response2).toBeDefined();
			expect(cache.stats).toBeDefined();
			expect(cache.stats.hits).toBe(1);
			// Verify that both responses have the same text content
			const text1 = await response.text();
			const text2 = await response2.text();
			expect(text1).toEqual(text2);
		},
		testTimeout,
	);

	test(
		"should throw an error if cache is not provided",
		async () => {
			const url = `${testUrl}/get`;
			const options: FetchOptions = {
				method: "GET",
				cache: undefined as unknown as Cacheable, // Force error
			};
			await expect(fetch(url, options)).rejects.toThrow(
				"Fetch options must include a cache instance or options.",
			);
		},
		testTimeout,
	);

	test(
		"should fetch data using get helper",
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
		"should cache data using get helper",
		async () => {
			const cache = new Cacheable({ stats: true });
			const url = `${testUrl}/get`;
			const options = {
				cache,
			};
			const result1 = await get(url, options);
			const result2 = await get(url, options);
			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
			expect(cache.stats).toBeDefined();
			expect(cache.stats.hits).toBe(1);
			// Verify that both responses have the same data
			expect(result1.data).toEqual(result2.data);
			// Verify response objects are valid
			expect(result1.response.status).toBe(200);
			expect(result2.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in get helper",
		async () => {
			const cache = new Cacheable();
			// Mock a text response by using a URL that returns plain text
			const mockTextUrl = "https://httpbin.org/robots.txt";
			const options = {
				cache,
			};
			const result = await get(mockTextUrl, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(typeof result.data).toBe("string");
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);
});
