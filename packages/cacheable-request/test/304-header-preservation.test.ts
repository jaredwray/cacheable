import { request } from "node:http";
import { promisify as pm } from "node:util";
import { gzip } from "node:zlib";
import delay from "delay";
import getStream from "get-stream";
import { afterAll, beforeAll, expect, test } from "vitest";
import CacheableRequest from "../src/index.js";
import createTestServer from "./create-test-server/index.mjs";

// Promisify cacheableRequest
// biome-ignore lint/suspicious/noExplicitAny: legacy test format
const promisify = (cacheableRequest: any) => async (options: any) =>
	new Promise((resolve, reject) => {
		// biome-ignore lint/suspicious/noExplicitAny: legacy test format
		cacheableRequest(options, async (response: any) => {
			const body = await getStream(response);
			response.body = body;
			// Give the cache time to update
			await delay(100);
			resolve(response);
		})
			// biome-ignore lint/suspicious/noExplicitAny: legacy test format
			.on("request", (request_: any) => request_.end())
			.once("error", reject);
	});

// biome-ignore lint/suspicious/noExplicitAny: legacy test format
let s: any;

beforeAll(async () => {
	s = await createTestServer();
	// biome-ignore lint/suspicious/noExplicitAny: legacy test format
	s.get("/compress-bug", async (request: any, response: any) => {
		const etag = "test-etag-123";

		if (request.headers["if-none-match"] === etag) {
			// 304 response with COMPLETELY EMPTY HEADERS
			// This simulates what some servers do
			response.statusCode = 304;
			response.end();
		} else {
			// Original 200 response with gzipped content
			const payload = JSON.stringify({ foo: "bar" });
			const compressed = await pm(gzip)(payload);

			response.setHeader("content-encoding", "gzip");
			response.setHeader("cache-control", "public, max-age=1");
			response.setHeader("etag", etag);
			response.end(compressed);
		}
	});
});

afterAll(async () => {
	await s.close();
});

test("304 with empty headers preserves Content-Encoding from cached response", async () => {
	const endpoint = "/compress-bug";
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());

	// First request - should get 200 with gzipped content
	// biome-ignore lint/suspicious/noExplicitAny: legacy test format
	const response1: any = await cacheableRequestHelper(s.url + endpoint);
	expect(response1.statusCode).toBe(200);
	expect(response1.headers["content-encoding"]).toBe("gzip");
	expect(response1.fromCache).toBeFalsy();

	// Wait for cache to expire (max-age=1)
	await delay(1100);

	// Second request - should trigger 304 revalidation with completely empty headers
	// biome-ignore lint/suspicious/noExplicitAny: legacy test format
	const response2: any = await cacheableRequestHelper(s.url + endpoint);

	// Should be 200 from cache after 304 revalidation
	expect(response2.statusCode).toBe(200);
	expect(response2.fromCache).toBe(true);

	// Content-Encoding and other entity headers should be preserved from the cached response
	// even when the 304 response has completely empty headers
	expect(response2.headers["content-encoding"]).toBe("gzip");
	expect(response2.headers.etag).toBe("test-etag-123");
	expect(response2.body.length).toBeGreaterThan(0);
});
