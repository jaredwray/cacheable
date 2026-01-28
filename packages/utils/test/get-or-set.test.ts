import { describe, expect, test, vi } from "vitest";
import { type GetOrSetOptions, getOrSet } from "../src/memoize.js";
import { MockCacheable } from "./mock-cacheable.js";

describe("cacheable get or set", () => {
	test("should cache results", async () => {
		const cacheable = new MockCacheable();
		const function_ = vi.fn(async () => 1 + 2);
		const result = await getOrSet("one_plus_two", function_, {
			cache: cacheable,
		});
		await getOrSet("one_plus_two", function_, { cache: cacheable });
		expect(result).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should prevent stampede", async () => {
		const cacheable = new MockCacheable();
		const function_ = vi.fn(async () => 42);
		await Promise.all([
			getOrSet("key1", function_, { cache: cacheable }),
			getOrSet("key1", function_, { cache: cacheable }),
			getOrSet("key2", function_, { cache: cacheable }),
			getOrSet("key2", function_, { cache: cacheable }),
		]);
		expect(function_).toHaveBeenCalledTimes(2);
	});

	test("should throw on getOrSet error (`true` option)", async () => {
		const cacheable = new MockCacheable();
		const function_ = vi.fn(async () => {
			throw new Error("Test error");
		});

		await expect(
			getOrSet("key", function_, { cache: cacheable, throwErrors: true }),
		).rejects.toThrow("Test error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on getOrSet error (`function` option)", async () => {
		const cacheable = new MockCacheable();
		const function_ = vi.fn(async () => {
			throw new Error("Test error");
		});

		await expect(
			getOrSet("key", function_, { cache: cacheable, throwErrors: "function" }),
		).rejects.toThrow("Test error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should not throw on getOrSet cache error (`function` option)", async () => {
		const cacheable = new MockCacheable();

		cacheable.set = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(async () => 1 + 2);

		expect(
			await getOrSet("key", function_, {
				cache: cacheable,
				throwErrors: "function",
			}),
		).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on getOrSet cache error on get (`store` option)", async () => {
		const cacheable = new MockCacheable();

		cacheable.get = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(async () => 1 + 2);

		await expect(
			getOrSet("key", function_, { cache: cacheable, throwErrors: "store" }),
		).rejects.toThrow("Cache error");
		expect(function_).toHaveBeenCalledTimes(0);
	});

	test("should not throw on getOrSet cache error on get (`function` option)", async () => {
		const cacheable = new MockCacheable();

		cacheable.get = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(async () => 1 + 2);

		expect(
			await getOrSet("key", function_, {
				cache: cacheable,
				throwErrors: "function",
			}),
		).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on getOrSet cache error (`store` option)", async () => {
		const cacheable = new MockCacheable();

		cacheable.set = () => {
			throw new Error("Cache error");
		};

		const function_ = vi.fn(async () => 1 + 2);

		await expect(
			getOrSet("key", function_, { cache: cacheable, throwErrors: "store" }),
		).rejects.toThrow("Cache error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should throw on getOrSet error with cache errors true", async () => {
		const cacheable = new MockCacheable();
		const function_ = vi.fn(async () => {
			throw new Error("Test error");
		});

		await expect(
			getOrSet("key", function_, {
				cache: cacheable,
				throwErrors: true,
				cacheErrors: true,
			}),
		).rejects.toThrow("Test error");
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should generate key via function on getOrSet", async () => {
		const cacheable = new MockCacheable();
		const generateKey = (options?: GetOrSetOptions) =>
			`custom_key_${options?.cacheId}`;
		const function_ = vi.fn(async () => Math.random() * 100);
		const result1 = await getOrSet(generateKey, function_, {
			cache: cacheable,
		});
		const result2 = await getOrSet(generateKey, function_, {
			cache: cacheable,
		});
		expect(result1).toBe(result2);
	});
});
