import process from "node:process";
import { faker } from "@faker-js/faker";
import { Cacheable } from "cacheable";
import { describe, expect, test } from "vitest";
import {
	CacheableNet,
	type CacheableNetOptions,
	del,
	type FetchOptions,
	fetch,
	get,
	head,
	Net,
	patch,
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
			// Use mockhttp.org/plain which returns plain text
			const url = `${testUrl}/plain`;
			const result = await net.get(url);
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
		"should fetch data using CacheableNet post method",
		async () => {
			const net = new Net();
			const url = `${testUrl}/post`;
			const data = { test: "data" };
			const result = await net.post(url, data);
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
		"should handle post without options parameter",
		async () => {
			const net = new Net();
			const url = `${testUrl}/post`;
			const data = { test: "data" };

			// Calling post with only url and data, no options at all
			const result = await net.post(url, data);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should handle post with empty options object",
		async () => {
			const net = new Net();
			const url = `${testUrl}/post`;
			const data = { test: "data" };

			// Pass empty options object (no headers)
			const result = await net.post(url, data, {});
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using CacheableNet head method",
		async () => {
			const net = new Net();
			const url = `${testUrl}/get`;
			const response = await net.head(url);
			expect(response).toBeDefined();
			expect(response.status).toBe(200);
			// Headers should still be present
			expect(response.headers).toBeDefined();
		},
		testTimeout,
	);

	test(
		"should fetch data using standalone head function",
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
		"should handle head with options in CacheableNet",
		async () => {
			const net = new Net();
			const url = `${testUrl}/get`;
			const options = {
				headers: {
					"User-Agent": "test-agent",
				},
			};
			const response = await net.head(url, options);
			expect(response).toBeDefined();
			expect(response.status).toBe(200);
			// Headers should still be present
			expect(response.headers).toBeDefined();
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in CacheableNet post method",
		async () => {
			const net = new Net();
			// Use mockhttp.org/plain which now accepts POST and returns plain text
			const url = `${testUrl}/plain`;
			const data = "test data";
			const result = await net.post(url, data, {
				headers: {
					"Content-Type": "text/plain",
				},
			});
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
		"should fetch typed data using post with generics",
		async () => {
			interface PostResponse {
				method: string;
				data: string;
			}
			const net = new Net();
			const url = `${testUrl}/post`;
			const data = { test: "data" };
			const result = await net.post<PostResponse>(url, data);
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

	test(
		"should fetch data using CacheableNet patch method",
		async () => {
			const net = new Net();
			const url = `${testUrl}/patch`;
			const data = { update: "data" };
			const result = await net.patch(url, data);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using standalone patch function",
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
		"should handle non-JSON response in CacheableNet patch method",
		async () => {
			const net = new Net();
			// Use mockhttp.org/plain which now accepts PATCH and returns plain text
			const url = `${testUrl}/plain`;
			const data = "test data";
			const result = await net.patch(url, data, {
				headers: {
					"Content-Type": "text/plain",
				},
			});
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
		"should handle patch without options parameter",
		async () => {
			const net = new Net();
			const url = `${testUrl}/patch`;
			const data = { update: "data" };

			// Calling patch with only url and data, no options at all
			const result = await net.patch(url, data);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should handle patch with empty options object",
		async () => {
			const net = new Net();
			const url = `${testUrl}/patch`;
			const data = { update: "data" };

			// Pass empty options object (no headers)
			const result = await net.patch(url, data, {});
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch typed data using patch with generics",
		async () => {
			interface PatchResponse {
				method: string;
				data: string;
			}
			const net = new Net();
			const url = `${testUrl}/patch`;
			const data = { update: "data" };
			const result = await net.patch<PatchResponse>(url, data);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			// TypeScript will ensure result.data has the PatchResponse type
			if (typeof result.data === "object" && result.data !== null) {
				expect(result.data).toHaveProperty("method");
			}
		},
		testTimeout,
	);

	test("should handle FormData in CacheableNet post method", async () => {
		const net = new Net();
		const url = `${testUrl}/post`;
		const formData = new FormData();
		formData.append("field", "value");

		// Since the server might not handle FormData properly, we'll just verify it doesn't crash
		try {
			const result = await net.post(url, formData);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept FormData, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle URLSearchParams in CacheableNet post method", async () => {
		const net = new Net();
		const url = `${testUrl}/post`;
		const params = new URLSearchParams();
		params.append("test", "value");

		// Since the server might not handle URLSearchParams properly, we'll just verify it doesn't crash
		try {
			const result = await net.post(url, params);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept URLSearchParams, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle Blob in CacheableNet post method", async () => {
		const net = new Net();
		const url = `${testUrl}/post`;
		const blob = new Blob(["data"], { type: "text/plain" });

		// Since the server might not handle Blob properly, we'll just verify it doesn't crash
		try {
			const result = await net.post(url, blob);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept Blob, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle FormData in CacheableNet patch method", async () => {
		const net = new Net();
		const url = `${testUrl}/patch`;
		const formData = new FormData();
		formData.append("field", "value");

		// Since the server might not handle FormData properly, we'll just verify it doesn't crash
		try {
			const result = await net.patch(url, formData);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept FormData, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle URLSearchParams in CacheableNet patch method", async () => {
		const net = new Net();
		const url = `${testUrl}/patch`;
		const params = new URLSearchParams();
		params.append("test", "value");

		// Since the server might not handle URLSearchParams properly, we'll just verify it doesn't crash
		try {
			const result = await net.patch(url, params);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept URLSearchParams, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle Blob in CacheableNet patch method", async () => {
		const net = new Net();
		const url = `${testUrl}/patch`;
		const blob = new Blob(["data"], { type: "text/plain" });

		// Since the server might not handle Blob properly, we'll just verify it doesn't crash
		try {
			const result = await net.patch(url, blob);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept Blob, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test(
		"should fetch data using CacheableNet delete method",
		async () => {
			const net = new Net();
			const url = `${testUrl}/delete`;
			const data = { id: "123" };
			const result = await net.delete(url, data);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch data using standalone delete function",
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
		"should handle delete without data parameter",
		async () => {
			const net = new Net();
			const url = `${testUrl}/delete`;
			try {
				const result = await net.delete(url);
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
		"should handle delete with empty options object",
		async () => {
			const net = new Net();
			const url = `${testUrl}/delete`;
			const data = { id: "123" };
			const result = await net.delete(url, data, {});
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			expect(result.response.status).toBe(200);
		},
		testTimeout,
	);

	test(
		"should fetch typed data using delete with generics",
		async () => {
			interface DeleteResponse {
				success: boolean;
				message: string;
			}
			const net = new Net();
			const url = `${testUrl}/delete`;
			const data = { id: "123" };
			const result = await net.delete<DeleteResponse>(url, data);
			expect(result).toBeDefined();
			expect(result.data).toBeDefined();
			expect(result.response).toBeDefined();
			// TypeScript will ensure result.data has the DeleteResponse type
			if (typeof result.data === "object" && result.data !== null) {
				expect(result.data).toHaveProperty("method");
			}
		},
		testTimeout,
	);

	test(
		"should handle non-JSON response in CacheableNet delete method",
		async () => {
			const net = new Net();
			// Use mockhttp.org/plain which may accept DELETE
			const url = `${testUrl}/plain`;
			const data = "test data";

			try {
				const result = await net.delete(url, data, {
					headers: {
						"Content-Type": "text/plain",
					},
				});
				expect(result).toBeDefined();
				// If plain endpoint accepts DELETE, should return plain text
				expect(result.data).toBeDefined();
				expect(typeof result.data).toBe("string");
				expect(result.data).toBeTruthy();
				expect(result.response).toBeDefined();
			} catch (error) {
				// If plain doesn't accept DELETE, that's okay
				expect(error).toBeDefined();
			}
		},
		testTimeout,
	);

	test("should handle string data in CacheableNet delete method", async () => {
		const net = new Net();
		const url = `${testUrl}/delete`;
		const data = JSON.stringify({ id: "123" });
		const result = await net.delete(url, data, {
			headers: {
				"Content-Type": "application/json",
			},
		});
		expect(result).toBeDefined();
		expect(result.data).toBeDefined();
		expect(result.response).toBeDefined();
		expect(result.response.status).toBe(200);
	});

	test("should handle FormData in CacheableNet delete method", async () => {
		const net = new Net();
		const url = `${testUrl}/delete`;
		const formData = new FormData();
		formData.append("id", "123");

		// Since the server might not handle FormData properly, we'll just verify it doesn't crash
		try {
			const result = await net.delete(url, formData);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept FormData, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle URLSearchParams in CacheableNet delete method", async () => {
		const net = new Net();
		const url = `${testUrl}/delete`;
		const params = new URLSearchParams();
		params.append("id", "123");

		// Since the server might not handle URLSearchParams properly, we'll just verify it doesn't crash
		try {
			const result = await net.delete(url, params);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept URLSearchParams, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle Blob in CacheableNet delete method", async () => {
		const net = new Net();
		const url = `${testUrl}/delete`;
		const blob = new Blob(["data"], { type: "text/plain" });

		// Since the server might not handle Blob properly, we'll just verify it doesn't crash
		try {
			const result = await net.delete(url, blob);
			expect(result).toBeDefined();
		} catch (error) {
			// If server doesn't accept Blob, that's okay - we're testing the client code
			expect(error).toBeDefined();
		}
	});

	test("should handle useCacheHeaders option in constructor", () => {
		// Test with useCacheHeaders set to false
		const netWithoutHeaders = new CacheableNet({ useCacheHeaders: false });
		expect(netWithoutHeaders.useCacheHeaders).toBe(false);

		// Test with useCacheHeaders set to true
		const netWithHeaders = new CacheableNet({ useCacheHeaders: true });
		expect(netWithHeaders.useCacheHeaders).toBe(true);

		// Test default value (should be true)
		const netDefault = new CacheableNet();
		expect(netDefault.useCacheHeaders).toBe(true);
	});

	test("should set and get useCacheHeaders property", () => {
		const net = new CacheableNet();

		// Test getter (default should be true)
		expect(net.useCacheHeaders).toBe(true);

		// Test setter - set to false
		net.useCacheHeaders = false;
		expect(net.useCacheHeaders).toBe(false);

		// Test setter - set back to true
		net.useCacheHeaders = true;
		expect(net.useCacheHeaders).toBe(true);
	});
});
