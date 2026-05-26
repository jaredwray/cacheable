// biome-ignore-all lint/style/noNonNullAssertion: test file
import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";
import { NodeCacheStore } from "../src/store.js";

const sleep = async (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

describe("NodeCacheStore", () => {
	test("should create a new instance", () => {
		const store = new NodeCacheStore();
		expect(store).toBeDefined();
	});
	test("should set a ttl", () => {
		const store = new NodeCacheStore({ ttl: 100 });
		expect(store.ttl).toBe(100);
		store.ttl = 200;
		expect(store.ttl).toBe(200);
	});
	test("should set a keyv store", () => {
		const store = new NodeCacheStore();
		expect(store.store).toBeDefined();
	});
	test("should be able to use keyv store with ttl", async () => {
		const store = new NodeCacheStore();
		expect(store.store).toBeDefined();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value);
		const result1 = await store.get(key);
		expect(result1).toBe(value);
		await store.set(key, value, 100);
		const result2 = await store.get(key);
		expect(result2).toBe(value);
		await sleep(200);
		const result3 = await store.get(key);
		expect(result3).toBeUndefined();
	});
	test("should clear the cache", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.clear();
		const result1 = await store.get(key);
		expect(result1).toBeUndefined();
	});
	test("should delete a key", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.del(key);
		const result1 = await store.get(key);
		expect(result1).toBeUndefined();
	});
	test("should be able to get and set an object", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const object = { [faker.string.uuid()]: faker.lorem.word() };
		await store.set(key, object);
		const result1 = await store.get(key);
		expect(result1).toEqual(object);
	});
	test("should be able to get and set an array", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const array = [faker.lorem.word(), faker.lorem.word()];
		await store.set(key, array);
		const result1 = await store.get(key);
		expect(result1).toEqual(array);
	});
	test("should be able to get and set a number", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.number.int({ min: 1, max: 9999 });
		await store.set(key, value);
		const result1 = await store.get(key);
		expect(result1).toBe(value);
	});
	test("should be able to get multiple keys", async () => {
		const store = new NodeCacheStore();
		const key1 = faker.string.uuid();
		const value1 = faker.lorem.word();
		const key2 = faker.string.uuid();
		const value2 = faker.lorem.word();
		await store.set(key1, value1);
		await store.set(key2, value2);
		const result1 = await store.mget([key1, key2]);
		expect(result1).toEqual({ [key1]: value1, [key2]: value2 });
	});
	test("should not pollute Object.prototype via mget with __proto__ key", async () => {
		const store = new NodeCacheStore();
		await store.set("__proto__", { polluted: true });
		const result = await store.mget(["__proto__"]);
		// biome-ignore lint/suspicious/noExplicitAny: testing prototype pollution
		expect((Object.prototype as any).polluted).toBeUndefined();
		expect(Object.getPrototypeOf(result)).toBeNull();
		expect(Object.hasOwn(result, "__proto__")).toBe(true);
	});
	test("should be able to set multiple keys", async () => {
		const store = new NodeCacheStore();
		const data = [
			{ key: faker.string.uuid(), value: faker.lorem.word() },
			{ key: faker.string.uuid(), value: faker.lorem.word() },
		];
		await store.mset(data);
		const result1 = await store.get(data[0].key);
		const result2 = await store.get(data[1].key);

		expect(result1).toBe(data[0].value);
		expect(result2).toBe(data[1].value);
	});
	test("should be able to delete multiple keys", async () => {
		const store = new NodeCacheStore();
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		await store.set(key1, faker.lorem.word());
		await store.set(key2, faker.lorem.word());
		await store.mdel([key1, key2]);
		const result1 = await store.get(key1);
		const result2 = await store.get(key2);
		expect(result1).toBeUndefined();
		expect(result2).toBeUndefined();
	});
	test("should be able to set a key with ttl", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value, 1000);
		const result1 = await store.get(key);
		expect(result1).toBe(value);
		const result2 = await store.setTtl(key, 1000);
		expect(result2).toBe(true);
	});
	test("should return false if no ttl is set", async () => {
		const store = new NodeCacheStore({ ttl: 1000 });
		const result1 = await store.setTtl(faker.string.uuid());
		expect(result1).toBe(false);
	});
	test("should be able to disconnect", async () => {
		const store = new NodeCacheStore();
		await store.disconnect();
	});
	test("should be able to take a key", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value);
		const result1 = await store.take<string>(key);
		expect(result1).toBe(value);
		const result2 = await store.get<string>(key);
		expect(result2).toBeUndefined();
	});
	test("should handle shorthand ttl strings", async () => {
		const store = new NodeCacheStore({ ttl: "1h" });
		const key1 = faker.string.uuid();
		const value1 = faker.lorem.word();
		await store.set(key1, value1);
		const result = await store.get(key1);
		expect(result).toBe(value1);
		const key2 = faker.string.uuid();
		const value2 = faker.lorem.word();
		await store.set(key2, value2, "100ms");
		const result2 = await store.get(key2);
		expect(result2).toBe(value2);
	});
	test("should handle mget with missing keys", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		const missingKey = faker.string.uuid();
		await store.set(key, value);
		const result = await store.mget([key, missingKey]);
		expect(result).toEqual({ [key]: value, [missingKey]: undefined });
	});
	test("should handle take on non-existent key", async () => {
		const store = new NodeCacheStore();
		const result = await store.take(faker.string.uuid());
		expect(result).toBeUndefined();
	});
	test("should handle ttl of 0 as unlimited", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value, 0);
		const result = await store.get(key);
		expect(result).toBe(value);
	});

	test("should return initial stats with all zeros", () => {
		const store = new NodeCacheStore();
		const stats = store.getStats();
		expect(stats).toEqual({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 });
	});
	test("should track hits and misses on get", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.get(key);
		await store.get(faker.string.uuid());
		const stats = store.getStats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
	});
	test("should track hits and misses on mget", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.mget([key, faker.string.uuid(), faker.string.uuid()]);
		const stats = store.getStats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(2);
	});
	test("should track ksize, vsize, and keys on set", async () => {
		const store = new NodeCacheStore();
		await store.set(faker.string.uuid(), faker.lorem.word());
		const stats = store.getStats();
		expect(stats.keys).toBe(1);
		expect(stats.ksize).toBeGreaterThan(0);
		expect(stats.vsize).toBeGreaterThan(0);
	});
	test("should track ksize, vsize, and keys on mset", async () => {
		const store = new NodeCacheStore();
		await store.mset([
			{ key: faker.string.uuid(), value: faker.lorem.word() },
			{ key: faker.string.uuid(), value: faker.lorem.word() },
		]);
		const stats = store.getStats();
		expect(stats.keys).toBe(2);
		expect(stats.ksize).toBeGreaterThan(0);
		expect(stats.vsize).toBeGreaterThan(0);
	});
	test("should decrease stats on del", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		const before = store.getStats();
		expect(before.keys).toBe(1);
		await store.del(key);
		const after = store.getStats();
		expect(after.keys).toBe(0);
		expect(after.ksize).toBe(0);
		expect(after.vsize).toBe(0);
	});
	test("should decrease stats on mdel", async () => {
		const store = new NodeCacheStore();
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		await store.set(key1, faker.lorem.word());
		await store.set(key2, faker.lorem.word());
		expect(store.getStats().keys).toBe(2);
		await store.mdel([key1, key2]);
		const stats = store.getStats();
		expect(stats.keys).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.vsize).toBe(0);
	});
	test("should track stats on take", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.take(key);
		await store.take(faker.string.uuid());
		const stats = store.getStats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.keys).toBe(0);
	});
	test("should reset store values on clear but preserve hits/misses", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.get(key);
		await store.get(faker.string.uuid());
		await store.clear();
		const stats = store.getStats();
		expect(stats.keys).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.vsize).toBe(0);
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
	});
	test("should flush all stats", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.get(key);
		store.flushStats();
		const stats = store.getStats();
		expect(stats).toEqual({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 });
	});
	test("should emit flush_stats event on flushStats", async () => {
		const store = new NodeCacheStore();
		let emitted = false;
		store.on("flush_stats", () => {
			emitted = true;
		});
		store.flushStats();
		expect(emitted).toBe(true);
	});

	test("should propagate class-level generic type through get, mget, and take", async () => {
		type MyType = { name: string; age: number };
		const store = new NodeCacheStore<MyType>();
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		const name1 = faker.person.firstName();
		const age1 = faker.number.int({ min: 1, max: 100 });
		const name2 = faker.person.firstName();
		const age2 = faker.number.int({ min: 1, max: 100 });
		await store.set(key1, { name: name1, age: age1 });
		await store.set(key2, { name: name2, age: age2 });

		const getResult = await store.get(key1);
		expect(getResult).toBeDefined();
		expect(getResult?.name).toBe(name1);
		expect(getResult?.age).toBe(age1);

		const mgetResult = await store.mget([key1, key2]);
		expect(mgetResult).toEqual({
			[key1]: { name: name1, age: age1 },
			[key2]: { name: name2, age: age2 },
		});

		const taken = await store.take(key2);
		expect(taken).toBeDefined();
		expect(taken?.name).toBe(name2);
		expect(taken?.age).toBe(age2);

		// Verify take removed the key
		const afterTake = await store.get(key2);
		expect(afterTake).toBeUndefined();
	});
});

describe("NodeCacheStore - keys()", () => {
	test("should return empty array for empty store", async () => {
		const store = new NodeCacheStore();
		const keys = await store.keys();
		expect(keys).toEqual([]);
	});

	test("should return all keys", async () => {
		const store = new NodeCacheStore();
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		await store.set(key1, faker.lorem.word());
		await store.set(key2, faker.lorem.word());
		const keys = await store.keys();
		expect(keys).toContain(key1);
		expect(keys).toContain(key2);
		expect(keys).toHaveLength(2);
	});

	test("should not include deleted keys", async () => {
		const store = new NodeCacheStore();
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		await store.set(key1, faker.lorem.word());
		await store.set(key2, faker.lorem.word());
		await store.del(key1);
		const keys = await store.keys();
		expect(keys).toEqual([key2]);
	});

	test("should not include keys after clear", async () => {
		const store = new NodeCacheStore();
		await store.set(faker.string.uuid(), faker.lorem.word());
		await store.set(faker.string.uuid(), faker.lorem.word());
		await store.clear();
		const keys = await store.keys();
		expect(keys).toEqual([]);
	});

	test("should not include keys after flushAll", async () => {
		const store = new NodeCacheStore();
		await store.set(faker.string.uuid(), faker.lorem.word());
		await store.flushAll();
		const keys = await store.keys();
		expect(keys).toEqual([]);
	});

	test("should handle numeric keys", async () => {
		const store = new NodeCacheStore();
		await store.set(42, faker.lorem.word());
		const keys = await store.keys();
		expect(keys).toContain("42");
	});
});

describe("NodeCacheStore - has()", () => {
	test("should return false for non-existent key", async () => {
		const store = new NodeCacheStore();
		const result = await store.has(faker.string.uuid());
		expect(result).toBe(false);
	});

	test("should return true for existing key", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		const result = await store.has(key);
		expect(result).toBe(true);
	});

	test("should return false for expired key", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 50);
		await sleep(100);
		const result = await store.has(key);
		expect(result).toBe(false);
	});

	test("should return false after deletion", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.del(key);
		const result = await store.has(key);
		expect(result).toBe(false);
	});

	test("should handle numeric keys", async () => {
		const store = new NodeCacheStore();
		await store.set(123, faker.lorem.word());
		expect(await store.has(123)).toBe(true);
		expect(await store.has(456)).toBe(false);
	});
});

describe("NodeCacheStore - getTtl()", () => {
	test("should return undefined for non-existent key", async () => {
		const store = new NodeCacheStore();
		const result = await store.getTtl(faker.string.uuid());
		expect(result).toBeUndefined();
	});

	test("should return 0 for key with no TTL (unlimited)", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		const result = await store.getTtl(key);
		expect(result).toBe(0);
	});

	test("should return expiration timestamp for key with TTL", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const before = Date.now();
		await store.set(key, faker.lorem.word(), 5000);
		const result = await store.getTtl(key);
		expect(result).toBeDefined();
		expect(result).toBeGreaterThan(before);
		expect(result).toBeLessThanOrEqual(before + 5000 + 100);
	});

	test("should return undefined for expired key and handle expiration", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 50);
		await sleep(100);
		const result = await store.getTtl(key);
		expect(result).toBeUndefined();
	});

	test("should return updated TTL after setTtl", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 1000);
		const firstTtl = await store.getTtl(key);
		await store.setTtl(key, 5000);
		const secondTtl = await store.getTtl(key);
		expect(secondTtl).toBeGreaterThan(firstTtl!);
	});

	test("should return 0 for key set with explicit 0 TTL", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 0);
		const result = await store.getTtl(key);
		expect(result).toBe(0);
	});

	test("should handle numeric keys", async () => {
		const store = new NodeCacheStore();
		await store.set(99, faker.lorem.word(), 5000);
		const result = await store.getTtl(99);
		expect(result).toBeGreaterThan(0);
	});
});

describe("NodeCacheStore - flushAll()", () => {
	test("should clear all data and reset all stats", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.get(key);
		await store.get(faker.string.uuid());
		await store.flushAll();
		const stats = store.getStats();
		expect(stats).toEqual({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 });
		const keys = await store.keys();
		expect(keys).toEqual([]);
	});

	test("should emit flush event", async () => {
		const store = new NodeCacheStore();
		let emitted = false;
		store.on("flush", () => {
			emitted = true;
		});
		await store.set(faker.string.uuid(), faker.lorem.word());
		await store.flushAll();
		expect(emitted).toBe(true);
	});

	test("should clear internal key and TTL tracking", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 5000);
		await store.flushAll();
		expect(await store.has(key)).toBe(false);
		expect(await store.getTtl(key)).toBeUndefined();
	});
});

describe("NodeCacheStore - Events", () => {
	test("should emit set event on set()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		let emittedKey: string | undefined;
		let emittedValue: string | undefined;
		store.on("set", (k, v) => {
			emittedKey = k as string;
			emittedValue = v as string;
		});
		await store.set(key, value);
		expect(emittedKey).toBe(key);
		expect(emittedValue).toBe(value);
	});

	test("should emit set event for each item in mset()", async () => {
		const store = new NodeCacheStore();
		const emittedKeys: string[] = [];
		store.on("set", (k) => {
			emittedKeys.push(k as string);
		});
		const data = [
			{ key: faker.string.uuid(), value: faker.lorem.word() },
			{ key: faker.string.uuid(), value: faker.lorem.word() },
		];
		await store.mset(data);
		expect(emittedKeys).toContain(data[0].key.toString());
		expect(emittedKeys).toContain(data[1].key.toString());
		expect(emittedKeys).toHaveLength(2);
	});

	test("should emit del event on del()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value);
		let emittedKey: string | undefined;
		let emittedValue: string | undefined;
		store.on("del", (k, v) => {
			emittedKey = k as string;
			emittedValue = v as string;
		});
		await store.del(key);
		expect(emittedKey).toBe(key);
		expect(emittedValue).toBe(value);
	});

	test("should emit del event for each item in mdel()", async () => {
		const store = new NodeCacheStore();
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		await store.set(key1, faker.lorem.word());
		await store.set(key2, faker.lorem.word());
		const emittedKeys: string[] = [];
		store.on("del", (k) => {
			emittedKeys.push(k as string);
		});
		await store.mdel([key1, key2]);
		expect(emittedKeys).toContain(key1);
		expect(emittedKeys).toContain(key2);
		expect(emittedKeys).toHaveLength(2);
	});

	test("should emit del event on take()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value);
		let emittedKey: string | undefined;
		let emittedValue: string | undefined;
		store.on("del", (k, v) => {
			emittedKey = k as string;
			emittedValue = v as string;
		});
		await store.take(key);
		expect(emittedKey).toBe(key);
		expect(emittedValue).toBe(value);
	});

	test("should emit expired event when accessing expired key via get()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value, 50);
		let expiredKey: string | undefined;
		store.on("expired", (k) => {
			expiredKey = k as string;
		});
		await sleep(100);
		const result = await store.get(key);
		expect(result).toBeUndefined();
		expect(expiredKey).toBe(key);
	});

	test("should emit expired event when accessing expired key via has()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value, 50);
		let expiredKey: string | undefined;
		store.on("expired", (k) => {
			expiredKey = k as string;
		});
		await sleep(100);
		const result = await store.has(key);
		expect(result).toBe(false);
		expect(expiredKey).toBe(key);
	});

	test("should emit expired event when accessing expired key via take()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value, 50);
		let expiredKey: string | undefined;
		store.on("expired", (k) => {
			expiredKey = k as string;
		});
		await sleep(100);
		const result = await store.take(key);
		expect(result).toBeUndefined();
		expect(expiredKey).toBe(key);
	});

	test("should emit expired event when accessing expired key via getTtl()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value, 50);
		let expiredKey: string | undefined;
		store.on("expired", (k) => {
			expiredKey = k as string;
		});
		await sleep(100);
		const result = await store.getTtl(key);
		expect(result).toBeUndefined();
		expect(expiredKey).toBe(key);
	});

	test("should not emit del event when del returns false", async () => {
		const store = new NodeCacheStore();
		let emitted = false;
		store.on("del", () => {
			emitted = true;
		});
		await store.del(faker.string.uuid());
		expect(emitted).toBe(false);
	});
});

describe("NodeCacheStore - useClones", () => {
	test("should default useClones to false", () => {
		const store = new NodeCacheStore();
		expect(store.useClones).toBe(false);
	});

	test("should set useClones via constructor", () => {
		const store = new NodeCacheStore({ useClones: true });
		expect(store.useClones).toBe(true);
	});

	test("should set useClones via setter", () => {
		const store = new NodeCacheStore();
		store.useClones = true;
		expect(store.useClones).toBe(true);
	});

	test("should return cloned objects when useClones is true", async () => {
		const store = new NodeCacheStore<{ name: string }>({ useClones: true });
		const key = faker.string.uuid();
		const value = { name: faker.person.firstName() };
		await store.set(key, value);
		const result = await store.get(key);
		expect(result).toEqual(value);
		if (result) {
			result.name = "modified";
		}

		const result2 = await store.get(key);
		expect(result2).toEqual(value);
	});

	test("should return same reference when useClones is false", async () => {
		const store = new NodeCacheStore<{ name: string }>({ useClones: false });
		const key = faker.string.uuid();
		const value = { name: faker.person.firstName() };
		await store.set(key, value);
		const result = await store.get(key);
		expect(result).toEqual(value);
	});

	test("should clone on take when useClones is true", async () => {
		const store = new NodeCacheStore<{ name: string }>({ useClones: true });
		const key = faker.string.uuid();
		const originalName = faker.person.firstName();
		const value = { name: originalName };
		await store.set(key, value);
		const result = await store.take(key);
		expect(result).toEqual({ name: originalName });
	});

	test("should handle null/undefined/primitives in clone", async () => {
		const store = new NodeCacheStore({ useClones: true });
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		const key3 = faker.string.uuid();
		await store.set(key1, null as unknown);
		await store.set(key2, 42);
		await store.set(key3, "hello");
		expect(await store.get(key1)).toBeNull();
		expect(await store.get(key2)).toBe(42);
		expect(await store.get(key3)).toBe("hello");
	});
});

describe("NodeCacheStore - deleteOnExpire", () => {
	test("should default deleteOnExpire to true", () => {
		const store = new NodeCacheStore();
		expect(store.deleteOnExpire).toBe(true);
	});

	test("should set deleteOnExpire via constructor", () => {
		const store = new NodeCacheStore({ deleteOnExpire: false });
		expect(store.deleteOnExpire).toBe(false);
	});

	test("should set deleteOnExpire via setter", () => {
		const store = new NodeCacheStore();
		store.deleteOnExpire = false;
		expect(store.deleteOnExpire).toBe(false);
	});

	test("should not delete expired key when deleteOnExpire is false", async () => {
		const store = new NodeCacheStore({ deleteOnExpire: false });
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 50);
		await sleep(100);
		expect(await store.has(key)).toBe(false);
		const keys = await store.keys();
		expect(keys).toContain(key);
	});

	test("should delete expired key when deleteOnExpire is true", async () => {
		const store = new NodeCacheStore({ deleteOnExpire: true });
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 50);
		await sleep(100);
		expect(await store.has(key)).toBe(false);
		const keys = await store.keys();
		expect(keys).not.toContain(key);
	});

	test("should emit expired event even when deleteOnExpire is false", async () => {
		const store = new NodeCacheStore({ deleteOnExpire: false });
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 50);
		let emitted = false;
		store.on("expired", () => {
			emitted = true;
		});
		await sleep(100);
		await store.get(key);
		expect(emitted).toBe(true);
	});
});

describe("NodeCacheStore - checkperiod / interval", () => {
	test("should not start interval when checkperiod is 0", () => {
		const store = new NodeCacheStore({ checkperiod: 0 });
		expect(store.getIntervalId()).toBe(0);
	});

	test("should start interval when checkperiod is set", () => {
		const store = new NodeCacheStore({ checkperiod: 60 });
		expect(store.getIntervalId()).not.toBe(0);
		store.close();
	});

	test("should stop interval on close()", () => {
		const store = new NodeCacheStore({ checkperiod: 60 });
		expect(store.getIntervalId()).not.toBe(0);
		store.close();
		expect(store.getIntervalId()).toBe(0);
	});

	test("should stop interval on disconnect()", async () => {
		const store = new NodeCacheStore({ checkperiod: 60 });
		expect(store.getIntervalId()).not.toBe(0);
		await store.disconnect();
		expect(store.getIntervalId()).toBe(0);
	});

	test("should expire items via checkperiod interval", async () => {
		const store = new NodeCacheStore({ checkperiod: 0.05 });
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		await store.set(key, value, 30);
		let expiredKey: string | undefined;
		store.on("expired", (k) => {
			expiredKey = k as string;
		});
		await sleep(150);
		expect(expiredKey).toBe(key);
		store.close();
	});

	test("close should be idempotent", () => {
		const store = new NodeCacheStore({ checkperiod: 60 });
		store.close();
		store.close();
		expect(store.getIntervalId()).toBe(0);
	});

	test("should not start interval by default", () => {
		const store = new NodeCacheStore();
		expect(store.getIntervalId()).toBe(0);
	});
});

describe("NodeCacheStore - clear() key/TTL tracking", () => {
	test("should clear internal key tracking on clear()", async () => {
		const store = new NodeCacheStore();
		await store.set(faker.string.uuid(), faker.lorem.word());
		await store.set(faker.string.uuid(), faker.lorem.word());
		await store.clear();
		expect(await store.keys()).toEqual([]);
	});

	test("should clear internal TTL tracking on clear()", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 5000);
		await store.clear();
		expect(await store.getTtl(key)).toBeUndefined();
	});
});

describe("NodeCacheStore - mdel key/TTL tracking", () => {
	test("should remove keys and TTLs from tracking on mdel", async () => {
		const store = new NodeCacheStore();
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		await store.set(key1, faker.lorem.word(), 5000);
		await store.set(key2, faker.lorem.word(), 5000);
		await store.mdel([key1, key2]);
		expect(await store.has(key1)).toBe(false);
		expect(await store.has(key2)).toBe(false);
		expect(await store.getTtl(key1)).toBeUndefined();
		expect(await store.getTtl(key2)).toBeUndefined();
	});
});

describe("NodeCacheStore - overwrite stats", () => {
	test("should not double-count stats when overwriting a key", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		await store.set(key, faker.lorem.word());
		const stats = store.getStats();
		expect(stats.keys).toBe(1);
	});

	test("should correctly update vsize on overwrite", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, "short");
		const before = store.getStats();
		await store.set(key, "a much longer string value");
		const after = store.getStats();
		expect(after.keys).toBe(1);
		expect(after.vsize).toBeGreaterThan(before.vsize);
	});

	test("should handle overwriting with undefined old value", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, undefined as unknown);
		await store.set(key, faker.lorem.word());
		const stats = store.getStats();
		expect(stats.keys).toBe(1);
	});
});

describe("NodeCacheStore - setTtl with falsy values", () => {
	test("should update TTL for cached value of 0", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, 0 as unknown);
		const result = await store.setTtl(key, 5000);
		expect(result).toBe(true);
	});

	test("should update TTL for cached empty string", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, "" as unknown);
		const result = await store.setTtl(key, 5000);
		expect(result).toBe(true);
	});

	test("should update TTL for cached false value", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, false as unknown);
		const result = await store.setTtl(key, 5000);
		expect(result).toBe(true);
	});

	test("should update TTL for cached null value", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, null as unknown);
		const result = await store.setTtl(key, 5000);
		expect(result).toBe(true);
	});
});

describe("NodeCacheStore - edge cases", () => {
	test("should handle del of key with undefined value in keyv", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, undefined as unknown, 5000);
		const result = await store.del(key);
		expect(result).toBe(true);
		expect(await store.has(key)).toBe(false);
	});

	test("should handle mdel of key with undefined value in keyv", async () => {
		const store = new NodeCacheStore();
		const key = faker.string.uuid();
		await store.set(key, undefined as unknown, 5000);
		const result = await store.mdel([key]);
		expect(result).toBe(true);
		expect(await store.has(key)).toBe(false);
	});

	test("checkData should skip non-expired items", async () => {
		const store = new NodeCacheStore({ checkperiod: 0.05 });
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word(), 60000);
		let emitted = false;
		store.on("expired", () => {
			emitted = true;
		});
		await sleep(100);
		expect(emitted).toBe(false);
		expect(await store.has(key)).toBe(true);
		store.close();
	});

	test("checkData should skip items with TTL 0 (unlimited)", async () => {
		const store = new NodeCacheStore({ checkperiod: 0.05 });
		const key = faker.string.uuid();
		await store.set(key, faker.lorem.word());
		let emitted = false;
		store.on("expired", () => {
			emitted = true;
		});
		await sleep(100);
		expect(emitted).toBe(false);
		expect(await store.has(key)).toBe(true);
		store.close();
	});

	test("isExpired should return false for key not in ttls map", async () => {
		const store = new NodeCacheStore();
		expect(await store.has(faker.string.uuid())).toBe(false);
	});
});
