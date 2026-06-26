import { describe, expect, test, vi } from "vitest";
import { type GetOrSetSyncOptions, getOrSetSync } from "../src/memoize.js";
import { MockCacheableMemory } from "./mock-cacheable.js";

describe("cacheable get or set sync", () => {
	test("should cache results", () => {
		const cacheable = new MockCacheableMemory();
		const function_ = vi.fn(() => 1 + 2);
		const result = getOrSetSync("one_plus_two", function_, {
			cache: cacheable,
		});
		getOrSetSync("one_plus_two", function_, { cache: cacheable });
		expect(result).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should store the value in the cache with ttl", () => {
		const cacheable = new MockCacheableMemory();
		const function_ = vi.fn(() => "value");
		const result = getOrSetSync("key", function_, {
			cache: cacheable,
			ttl: "1h",
		});
		expect(result).toBe("value");
		expect(cacheable.get("key")).toBe("value");
	});

	test("should generate key via function", () => {
		const cacheable = new MockCacheableMemory();
		const generateKey = (options?: GetOrSetSyncOptions) =>
			`custom_key_${options?.ttl}`;
		const function_ = vi.fn(() => Math.random() * 100);
		const result1 = getOrSetSync(generateKey, function_, {
			cache: cacheable,
			ttl: 100,
		});
		const result2 = getOrSetSync(generateKey, function_, {
			cache: cacheable,
			ttl: 100,
		});
		expect(result1).toBe(result2);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on error (`true` option)", () => {
		const cacheable = new MockCacheableMemory();
		const function_ = vi.fn(() => {
			throw new Error("Test error");
		});

		expect(() =>
			getOrSetSync("key", function_, { cache: cacheable, throwErrors: true }),
		).toThrow("Test error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on error (`function` option)", () => {
		const cacheable = new MockCacheableMemory();
		const function_ = vi.fn(() => {
			throw new Error("Test error");
		});

		expect(() =>
			getOrSetSync("key", function_, {
				cache: cacheable,
				throwErrors: "function",
			}),
		).toThrow("Test error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should not throw on cache set error (`function` option)", () => {
		const cacheable = new MockCacheableMemory();

		cacheable.set = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(() => 1 + 2);

		expect(
			getOrSetSync("key", function_, {
				cache: cacheable,
				throwErrors: "function",
			}),
		).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on cache error on get (`store` option)", () => {
		const cacheable = new MockCacheableMemory();

		cacheable.get = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(() => 1 + 2);

		expect(() =>
			getOrSetSync("key", function_, {
				cache: cacheable,
				throwErrors: "store",
			}),
		).toThrow("Cache error");
		expect(function_).toHaveBeenCalledTimes(0);
	});

	test("should not throw on cache error on get (`function` option)", () => {
		const cacheable = new MockCacheableMemory();

		cacheable.get = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(() => 1 + 2);

		expect(
			getOrSetSync("key", function_, {
				cache: cacheable,
				throwErrors: "function",
			}),
		).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on cache error on set (`store` option)", () => {
		const cacheable = new MockCacheableMemory();

		cacheable.set = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(() => 1 + 2);

		expect(() =>
			getOrSetSync("key", function_, {
				cache: cacheable,
				throwErrors: "store",
			}),
		).toThrow("Cache error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on error with cache errors true", () => {
		const cacheable = new MockCacheableMemory();
		const function_ = vi.fn(() => {
			throw new Error("Test error");
		});

		expect(() =>
			getOrSetSync("key", function_, {
				cache: cacheable,
				throwErrors: true,
				cacheErrors: true,
			}),
		).toThrow("Test error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should emit an error by default and return undefined without caching", () => {
		const cacheable = new MockCacheableMemory();
		const function_ = vi.fn(() => {
			throw new Error("Test error");
		});

		let errorCallCount = 0;
		cacheable.on("error", (error) => {
			expect(error.message).toBe("Test error");
			errorCallCount++;
		});

		const result = getOrSetSync("key", function_, { cache: cacheable });

		expect(result).toBeUndefined();
		expect(errorCallCount).toBe(1);
		expect(cacheable.get("key")).toBeUndefined();
	});

	test("should cache the error when cacheErrors is set", () => {
		const cacheable = new MockCacheableMemory();
		const function_ = vi.fn(() => {
			throw new Error("Test error");
		});

		let errorCallCount = 0;
		cacheable.on("error", () => {
			errorCallCount++;
		});

		getOrSetSync("key", function_, { cache: cacheable, cacheErrors: true });
		const cached = cacheable.get("key");

		expect(cached).toBeInstanceOf(Error);
		expect(function_).toHaveBeenCalledTimes(1);
		expect(errorCallCount).toBe(1);
	});
});
