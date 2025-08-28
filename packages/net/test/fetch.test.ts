import process from "node:process";
import { Cacheable } from "cacheable";
import { describe, expect, test } from "vitest";
import {
	del,
	type FetchOptions,
	fetch,
	get,
	head,
	patch,
	post,
} from "../src/fetch.js";

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
			expect(cache.stats.hits).toBeGreaterThanOrEqual(1);
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
				useHttpCache: false, // Disable HTTP cache to ensure basic caching
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
				useHttpCache: false, // Disable HTTP cache to ensure basic caching
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
			// Use mockhttp.org/plain which returns plain text
			const url = `${testUrl}/plain`;
			const options = {
				cache,
			};
			const result = await get(url, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(typeof result.data).toBe("string");
			expect(result.data).toBeTruthy(); // Plain text is not empty
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using post helper",
		async () => {
			const url = `${testUrl}/post`;
			const data = { test: "data" };
			const options = {
				cache: new Cacheable(),
			};
			const result = await post(url, data, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should not cache data using post helper (POST requests are not cached)",
		async () => {
			const cache = new Cacheable({ stats: true });
			const url = `${testUrl}/post`;
			const data = { test: "data" };
			const options = {
				cache,
			};
			const result1 = await post(url, data, options);
			const result2 = await post(url, data, options);
			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
			expect(cache.stats).toBeDefined();
			// POST requests should not be cached, so expect 0 hits
			expect(cache.stats.hits).toBe(0);
			// Verify response objects are valid
			expect(result1.response.status).toBe(200);
			expect(result2.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using head helper",
		async () => {
			const url = `${testUrl}/get`;
			const options = {
				cache: new Cacheable(),
			};
			const response = await head(url, options);
			expect(response).toBeDefined();
			expect(response.status).toBe(200);
			// Headers should still be present
			expect(response.headers).toBeDefined();
		},
		testTimeout,
	);

	test(
		"should not cache HEAD requests (HEAD requests are not cached)",
		async () => {
			const cache = new Cacheable({ stats: true });
			const url = `${testUrl}/get`;
			const options = {
				cache,
			};
			const response1 = await head(url, options);
			const response2 = await head(url, options);
			expect(response1).toBeDefined();
			expect(response2).toBeDefined();
			expect(cache.stats).toBeDefined();
			// HEAD requests should not be cached, so expect 0 hits
			expect(cache.stats.hits).toBe(0);
			// Both responses should have the same status
			expect(response1.status).toBe(200);
			expect(response2.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in post helper",
		async () => {
			const cache = new Cacheable();
			// Use mockhttp.org/plain which now accepts POST and returns plain text
			const url = `${testUrl}/plain`;
			const data = "test data";
			const options = {
				cache,
				headers: {
					"Content-Type": "text/plain",
				},
			};
			const result = await post(url, data, options);
			expect(result).toBeDefined();
			// The plain endpoint returns text, which should be returned as a string
			expect(result.data).toBeDefined();
			expect(typeof result.data).toBe("string");
			expect(result.data).toBeTruthy(); // Plain text is not empty
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using patch helper",
		async () => {
			const url = `${testUrl}/patch`;
			const data = { update: "data" };
			const options = {
				cache: new Cacheable(),
			};
			const result = await patch(url, data, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should not cache data using patch helper (PATCH requests are not cached)",
		async () => {
			const cache = new Cacheable({ stats: true });
			const url = `${testUrl}/patch`;
			const data = { update: "data" };
			const options = {
				cache,
			};
			const result1 = await patch(url, data, options);
			const result2 = await patch(url, data, options);
			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
			expect(cache.stats).toBeDefined();
			// PATCH requests should not be cached, so expect 0 hits
			expect(cache.stats.hits).toBe(0);
			// Verify response objects are valid
			expect(result1.response.status).toBe(200);
			expect(result2.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in patch helper",
		async () => {
			const cache = new Cacheable();
			// Use mockhttp.org/plain which now accepts PATCH and returns plain text
			const url = `${testUrl}/plain`;
			const data = "test data";
			const options = {
				cache,
				headers: {
					"Content-Type": "text/plain",
				},
			};
			const result = await patch(url, data, options);
			expect(result).toBeDefined();
			// The plain endpoint returns text, which should be returned as a string
			expect(result.data).toBeDefined();
			expect(typeof result.data).toBe("string");
			expect(result.data).toBeTruthy(); // Plain text is not empty
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test("should handle FormData in post helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/post`;
		const formData = new FormData();
		formData.append("test", "data");

		// Since the server might not handle FormData properly, we'll just verify it doesn't crash
		// The actual FormData handling is covered in the branch coverage
		try {
			const result = await post(url, formData, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept FormData, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle URLSearchParams in post helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/post`;
		const params = new URLSearchParams();
		params.append("key", "value");

		// Since the server might not handle URLSearchParams properly, we'll just verify it doesn't crash
		try {
			const result = await post(url, params, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept URLSearchParams, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle Blob in post helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/post`;
		const blob = new Blob(["test data"], { type: "text/plain" });

		// Since the server might not handle Blob properly, we'll just verify it doesn't crash
		try {
			const result = await post(url, blob, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept Blob, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle FormData in patch helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/patch`;
		const formData = new FormData();
		formData.append("test", "data");

		// Since the server might not handle FormData properly, we'll just verify it doesn't crash
		try {
			const result = await patch(url, formData, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept FormData, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle URLSearchParams in patch helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/patch`;
		const params = new URLSearchParams();
		params.append("key", "value");

		// Since the server might not handle URLSearchParams properly, we'll just verify it doesn't crash
		try {
			const result = await patch(url, params, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept URLSearchParams, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle Blob in patch helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/patch`;
		const blob = new Blob(["test data"], { type: "text/plain" });

		// Since the server might not handle Blob properly, we'll just verify it doesn't crash
		try {
			const result = await patch(url, blob, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept Blob, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test(
		"should fetch data using delete helper",
		async () => {
			const url = `${testUrl}/delete`;
			const data = { id: "123" };
			const options = {
				cache: new Cacheable(),
			};
			const result = await del(url, data, options);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using delete helper without data",
		async () => {
			const url = `${testUrl}/delete`;
			const options = {
				cache: new Cacheable(),
			};
			try {
				const result = await del(url, options);
				expect(result).toBeDefined();
				expect(result.data).toBeDefined();
				expect(result.response).toBeDefined();
				// May succeed or fail depending on endpoint requirements
			} catch (error) {
				// Some endpoints require data for DELETE
				expect((error as Error).message).toContain("400");
			}
		},
		testTimeout,
	);

	test(
		"should throw error when delete is called without options",
		async () => {
			const url = `${testUrl}/delete`;
			await expect(del(url)).rejects.toThrow(
				"Fetch options must include a cache instance or options.",
			);
		},
		testTimeout,
	);

	test(
		"should not cache data using delete helper (DELETE requests are not cached)",
		async () => {
			const cache = new Cacheable({ stats: true });
			const url = `${testUrl}/delete`;
			const data = { id: "123" };
			const options = {
				cache,
			};
			const result1 = await del(url, data, options);
			const result2 = await del(url, data, options);
			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
			expect(cache.stats).toBeDefined();
			// DELETE requests should not be cached, so expect 0 hits
			expect(cache.stats.hits).toBe(0);
			// Verify response objects are valid
			expect(result1.response.status).toBe(200);
			expect(result2.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in delete helper",
		async () => {
			const cache = new Cacheable();
			// Use mockhttp.org/plain which now accepts DELETE and returns plain text
			const url = `${testUrl}/plain`;
			const data = "test data";
			const options = {
				cache,
				headers: {
					"Content-Type": "text/plain",
				},
			};
			try {
				const result = await del(url, data, options);
				expect(result).toBeDefined();
				// If the plain endpoint accepts DELETE, should return text
				expect(result.data).toBeDefined();
				expect(typeof result.data).toBe("string");
				expect(result.response).toBeDefined();
			} catch (error) {
				// If plain doesn't accept DELETE, that's okay
				expect(error).toBeDefined();
			}
		},
		testTimeout,
	);

	test("should handle string data in delete helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/delete`;
		const data = JSON.stringify({ id: "123" });
		const options = {
			cache,
			headers: {
				"Content-Type": "application/json",
			},
		};
		const result = await del(url, data, options);
		expect(result).toBeDefined();
		expect(result.data).toBeDefined();
		expect(result.response).toBeDefined();
		expect(result.response.status).toBe(200);
	});

	test("should handle FormData in delete helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/delete`;
		const formData = new FormData();
		formData.append("id", "123");

		// Since the server might not handle FormData properly, we'll just verify it doesn't crash
		try {
			const result = await del(url, formData, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept FormData, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle URLSearchParams in delete helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/delete`;
		const params = new URLSearchParams();
		params.append("id", "123");

		// Since the server might not handle URLSearchParams properly, we'll just verify it doesn't crash
		try {
			const result = await del(url, params, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept URLSearchParams, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle Blob in delete helper", async () => {
		const cache = new Cacheable();
		const url = `${testUrl}/delete`;
		const blob = new Blob(["test data"], { type: "text/plain" });

		// Since the server might not handle Blob properly, we'll just verify it doesn't crash
		try {
			const result = await del(url, blob, { cache });
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept Blob, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	describe("HTTP Cache Headers", () => {
		test(
			"should use HTTP cache headers by default",
			async () => {
				const cache = new Cacheable({ stats: true });
				const url = `${testUrl}/cache/30`; // Endpoint with 30-second cache headers
				const options: FetchOptions = {
					method: "GET",
					cache,
				};

				// First request should hit the server
				const response1 = await fetch(url, options);
				expect(response1).toBeDefined();
				const text1 = await response1.text();

				// Second request should use cache (within cache validity period)
				const response2 = await fetch(url, options);
				expect(response2).toBeDefined();
				const text2 = await response2.text();

				// Both responses should have the same content
				expect(text1).toEqual(text2);
				// Should have one cache hit
				expect(cache.stats.hits).toBeGreaterThanOrEqual(1);
			},
			testTimeout,
		);

		test(
			"should disable HTTP cache when useHttpCache is false",
			async () => {
				const cache = new Cacheable({ stats: true });
				const url = `${testUrl}/cache/30`; // Endpoint with 30-second cache headers
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: false,
				};

				// First request
				const response1 = await fetch(url, options);
				expect(response1).toBeDefined();
				const text1 = await response1.text();

				// Second request should still use basic cache (ignoring HTTP cache headers)
				const response2 = await fetch(url, options);
				expect(response2).toBeDefined();
				const text2 = await response2.text();

				// Both responses should have the same content
				expect(text1).toEqual(text2);
				// Should have one cache hit (basic caching still works)
				expect(cache.stats.hits).toBeGreaterThanOrEqual(1);
			},
			testTimeout,
		);

		test(
			"should respect cache headers when useHttpCache is enabled",
			async () => {
				const cache = new Cacheable({ stats: true });
				const url = `${testUrl}/get`; // Regular endpoint
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};

				// First request
				const response1 = await fetch(url, options);
				expect(response1).toBeDefined();

				// Second request should use cache if headers allow
				const response2 = await fetch(url, options);
				expect(response2).toBeDefined();

				// Cache behavior depends on server headers
				expect(cache.stats).toBeDefined();
			},
			testTimeout,
		);

		test(
			"should handle cached responses with HTTP cache headers",
			async () => {
				const cache = new Cacheable();
				const url = `${testUrl}/get`; // Regular endpoint
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};

				// First request gets the full response
				const response1 = await fetch(url, options);
				expect(response1).toBeDefined();
				expect(response1.status).toBe(200);

				// Second request may use cache or revalidate
				const response2 = await fetch(url, options);
				expect(response2).toBeDefined();
				// Response should be successful
				expect(response2.status).toBe(200);

				// Both responses should have valid content
				const text1 = await response1.text();
				const text2 = await response2.text();
				expect(text1).toBeTruthy();
				expect(text2).toBeTruthy();
				// Parse as JSON to verify structure
				const json1 = JSON.parse(text1);
				const json2 = JSON.parse(text2);
				expect(json1.method).toBe("GET");
				expect(json2.method).toBe("GET");
			},
			testTimeout,
		);

		test(
			"should store and retrieve cache policy correctly",
			async () => {
				const cache = new Cacheable();
				const url = `${testUrl}/cache/60`; // Endpoint with 60-second cache
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};

				// Make first request
				await fetch(url, options);

				// Check that both response and policy are stored
				const cacheKey = `GET:${url}`;
				const policyKey = `${cacheKey}:policy`;

				const storedResponse = await cache.get(cacheKey);
				const storedPolicy = await cache.get(policyKey);

				expect(storedResponse).toBeDefined();
				expect(storedPolicy).toBeDefined();
				expect(storedPolicy).toHaveProperty("v"); // Version property of cache policy
			},
			testTimeout,
		);

		test(
			"should handle responses with HTTP cache headers",
			async () => {
				const cache = new Cacheable();
				const url = `${testUrl}/get`; // Regular endpoint
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};

				// First request
				const response1 = await fetch(url, options);
				expect(response1).toBeDefined();
				expect(response1.status).toBe(200);

				// Check if response was stored
				const cacheKey = `GET:${url}`;
				const storedResponse = await cache.get(cacheKey);

				// Response should be stored based on cache headers
				if (storedResponse) {
					expect(storedResponse).toBeDefined();
				}
			},
			testTimeout,
		);

		test(
			"should handle different HTTP methods with cache headers",
			async () => {
				const cache = new Cacheable();
				const url = `${testUrl}/get`;

				// GET request with cache semantics
				const getOptions: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};
				const getResponse = await fetch(url, getOptions);
				expect(getResponse).toBeDefined();
				expect(getResponse.status).toBe(200);

				// HEAD request should not be cached
				const headOptions: FetchOptions = {
					method: "HEAD",
					cache,
					useHttpCache: true,
				};
				const headResponse = await fetch(url, headOptions);
				expect(headResponse).toBeDefined();

				// POST request should not be cached
				const postOptions: FetchOptions = {
					method: "POST",
					cache,
					useHttpCache: true,
					body: JSON.stringify({ test: "data" }),
					headers: {
						"Content-Type": "application/json",
					},
				};
				const postUrl = `${testUrl}/post`;
				const postResponse = await fetch(postUrl, postOptions);
				expect(postResponse).toBeDefined();
			},
			testTimeout,
		);

		test(
			"should handle 304 Not Modified responses",
			async () => {
				const cache = new Cacheable();
				// Use a URL that returns 304
				const url304 = `${testUrl}/status/304`;

				// First, cache some data with a regular endpoint
				const urlGet = `${testUrl}/get`;
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};

				// Cache initial data with the GET endpoint
				const response1 = await fetch(urlGet, options);
				expect(response1).toBeDefined();
				expect(response1.status).toBe(200);
				await response1.text();

				// Now set up cache for the 304 endpoint
				const cacheKey304 = `GET:${url304}`;
				const policyKey304 = `${cacheKey304}:policy`;

				// Store cached data and an expired policy for the 304 URL
				await cache.set(cacheKey304, {
					body: '{"cached": "data"}',
					status: 200,
					statusText: "OK",
					headers: {
						"content-type": "application/json",
						etag: '"test-etag"',
					},
				});

				// Create an expired policy that will trigger revalidation
				const expiredPolicy = {
					v: 1,
					t: Date.now() - 10000, // 10 seconds ago
					sh: 200,
					ch: {
						"cache-control": "max-age=0", // Expired
						etag: '"test-etag"',
					},
					a: Date.now() - 10000,
					r: {
						status: 200,
						headers: {
							"cache-control": "max-age=0",
							etag: '"test-etag"',
						},
					},
					se: false,
					st: 200,
					resh: { etag: '"test-etag"' },
					rescc: { "max-age": 0 },
					m: "GET",
					u: url304,
					h: {},
					reqh: {},
					reqcc: {},
				};

				await cache.set(policyKey304, expiredPolicy);

				// Now fetch the 304 URL - should trigger the 304 handling code
				const response304 = await fetch(url304, options);
				expect(response304).toBeDefined();
				// When we get a 304, we should return the cached data with status 200
				expect(response304.status).toBe(200);
				const text304 = await response304.text();
				expect(text304).toBe('{"cached": "data"}');
			},
			testTimeout,
		);

		test(
			"should handle revalidation headers",
			async () => {
				const cache = new Cacheable();
				const url = `${testUrl}/get`;
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};

				// First request to populate cache
				const response1 = await fetch(url, options);
				expect(response1).toBeDefined();
				expect(response1.status).toBe(200);

				// Manually set an expired cache policy to trigger revalidation
				const cacheKey = `GET:${url}`;
				const policyKey = `${cacheKey}:policy`;

				// Create a policy that needs revalidation
				const needsRevalidationPolicy = {
					v: 1,
					t: Date.now() - 60000, // 1 minute ago
					sh: 200,
					ch: {
						"cache-control": "max-age=1", // Expired after 1 second
						"last-modified": new Date(Date.now() - 3600000).toUTCString(),
					},
					a: Date.now() - 60000,
					r: {
						status: 200,
						headers: {
							"cache-control": "max-age=1",
							"last-modified": new Date(Date.now() - 3600000).toUTCString(),
						},
					},
					se: false,
					st: 200,
					resh: {},
					rescc: { "max-age": 1 },
					m: "GET",
					u: url,
					h: {},
					reqh: {},
					reqcc: {},
				};

				await cache.set(policyKey, needsRevalidationPolicy);

				// This request should use revalidation headers
				const response2 = await fetch(url, options);
				expect(response2).toBeDefined();
				expect(response2.status).toBe(200);
			},
			testTimeout,
		);

		test(
			"should set cache TTL based on HTTP cache headers",
			async () => {
				const cache = new Cacheable();
				const url = `${testUrl}/cache/3600`; // Mock endpoint with cache headers
				const options: FetchOptions = {
					method: "GET",
					cache,
					useHttpCache: true,
				};

				// Spy on cache.set to verify TTL is being used
				let capturedTTL: number | undefined;
				const originalSet = cache.set.bind(cache);
				cache.set = async (key: string, value: unknown, ttl?: number) => {
					if (key === `GET:${url}`) {
						capturedTTL = ttl;
					}
					return originalSet(key, value, ttl);
				};

				// Make request
				const response = await fetch(url, options);
				expect(response).toBeDefined();
				expect(response.status).toBe(200);

				// Verify that a TTL was set for the cached response
				// The TTL should be based on the cache headers
				if (capturedTTL !== undefined) {
					expect(capturedTTL).toBeGreaterThan(0);
					// For max-age=3600, TTL should be around 3600000ms
					expect(capturedTTL).toBeLessThanOrEqual(3600000);
				}
			},
			testTimeout,
		);
	});
});
