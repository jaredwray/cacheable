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
