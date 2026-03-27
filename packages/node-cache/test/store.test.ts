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
		await store.set("test", "value");
		const result1 = await store.get("test");
		expect(result1).toBe("value");
		await store.set("test", "value", 100);
		const result2 = await store.get("test");
		expect(result2).toBe("value");
		await sleep(200);
		const result3 = await store.get("test");
		expect(result3).toBeUndefined();
	});
	test("should clear the cache", async () => {
		const store = new NodeCacheStore();
		await store.set("test", "value");
		await store.clear();
		const result1 = await store.get("test");
		expect(result1).toBeUndefined();
	});
	test("should delete a key", async () => {
		const store = new NodeCacheStore();
		await store.set("test", "value");
		await store.del("test");
		const result1 = await store.get("test");
		expect(result1).toBeUndefined();
	});
	test("should be able to get and set an object", async () => {
		const store = new NodeCacheStore();
		await store.set("test", { foo: "bar" });
		const result1 = await store.get("test");
		expect(result1).toEqual({ foo: "bar" });
	});
	test("should be able to get and set an array", async () => {
		const store = new NodeCacheStore();
		await store.set("test", ["foo", "bar"]);
		const result1 = await store.get("test");
		expect(result1).toEqual(["foo", "bar"]);
	});
	test("should be able to get and set a number", async () => {
		const store = new NodeCacheStore();
		await store.set("test", 123);
		const result1 = await store.get("test");
		expect(result1).toBe(123);
	});
	test("should be able to get multiple keys", async () => {
		const store = new NodeCacheStore();
		await store.set("test1", "value1");
		await store.set("test2", "value2");
		const result1 = await store.mget(["test1", "test2"]);
		expect(result1).toEqual({ test1: "value1", test2: "value2" });
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
		await store.set("test1", "value1");
		await store.set("test2", "value2");
		await store.mdel(["test1", "test2"]);
		const result1 = await store.get("test1");
		const result2 = await store.get("test2");
		expect(result1).toBeUndefined();
		expect(result2).toBeUndefined();
	});
	test("should be able to set a key with ttl", async () => {
		const store = new NodeCacheStore();
		await store.set("test", "value", 1000);
		const result1 = await store.get("test");
		expect(result1).toBe("value");
		const result2 = await store.setTtl("test", 1000);
		expect(result2).toBe(true);
	});
	test("should return false if no ttl is set", async () => {
		const store = new NodeCacheStore({ ttl: 1000 });
		const result1 = await store.setTtl("test");
		expect(result1).toBe(false);
	});
	test("should be able to disconnect", async () => {
		const store = new NodeCacheStore();
		await store.disconnect();
	});
	test("should be able to take a key", async () => {
		const store = new NodeCacheStore();
		await store.set("test", "value");
		const result1 = await store.take<string>("test");
		expect(result1).toBe("value");
		const result2 = await store.get<string>("test");
		expect(result2).toBeUndefined();
	});
	test("should handle shorthand ttl strings", async () => {
		const store = new NodeCacheStore({ ttl: "1h" });
		await store.set("test", "value");
		const result = await store.get("test");
		expect(result).toBe("value");
		await store.set("test2", "value2", "100ms");
		const result2 = await store.get("test2");
		expect(result2).toBe("value2");
	});
	test("should handle mget with missing keys", async () => {
		const store = new NodeCacheStore();
		await store.set("existing", "value");
		const result = await store.mget(["existing", "missing"]);
		expect(result.existing).toBe("value");
		expect(result.missing).toBeUndefined();
	});
	test("should handle take on non-existent key", async () => {
		const store = new NodeCacheStore();
		const result = await store.take("nonexistent");
		expect(result).toBeUndefined();
	});
	test("should handle ttl of 0 as unlimited", async () => {
		const store = new NodeCacheStore();
		await store.set("test", "value", 0);
		const result = await store.get("test");
		expect(result).toBe("value");
	});

	test("should return initial stats with all zeros", () => {
		const store = new NodeCacheStore();
		const stats = store.getStats();
		expect(stats).toEqual({ keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 });
	});
	test("should track hits and misses on get", async () => {
		const store = new NodeCacheStore();
		await store.set("test", "value");
		await store.get("test");
		await store.get("missing");
		const stats = store.getStats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
	});
	test("should track hits and misses on mget", async () => {
		const store = new NodeCacheStore();
		await store.set("key1", "value1");
		await store.mget(["key1", "missing1", "missing2"]);
		const stats = store.getStats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(2);
	});
	test("should track ksize, vsize, and keys on set", async () => {
		const store = new NodeCacheStore();
		await store.set("foo", "bar");
		const stats = store.getStats();
		expect(stats.keys).toBe(1);
		expect(stats.ksize).toBeGreaterThan(0);
		expect(stats.vsize).toBeGreaterThan(0);
	});
	test("should track ksize, vsize, and keys on mset", async () => {
		const store = new NodeCacheStore();
		await store.mset([
			{ key: "a", value: "1" },
			{ key: "b", value: "2" },
		]);
		const stats = store.getStats();
		expect(stats.keys).toBe(2);
		expect(stats.ksize).toBeGreaterThan(0);
		expect(stats.vsize).toBeGreaterThan(0);
	});
	test("should decrease stats on del", async () => {
		const store = new NodeCacheStore();
		await store.set("foo", "bar");
		const before = store.getStats();
		expect(before.keys).toBe(1);
		await store.del("foo");
		const after = store.getStats();
		expect(after.keys).toBe(0);
		expect(after.ksize).toBe(0);
		expect(after.vsize).toBe(0);
	});
	test("should decrease stats on mdel", async () => {
		const store = new NodeCacheStore();
		await store.set("a", "1");
		await store.set("b", "2");
		expect(store.getStats().keys).toBe(2);
		await store.mdel(["a", "b"]);
		const stats = store.getStats();
		expect(stats.keys).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.vsize).toBe(0);
	});
	test("should track stats on take", async () => {
		const store = new NodeCacheStore();
		await store.set("foo", "bar");
		await store.take("foo");
		await store.take("missing");
		const stats = store.getStats();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.keys).toBe(0);
	});
	test("should reset store values on clear but preserve hits/misses", async () => {
		const store = new NodeCacheStore();
		await store.set("foo", "bar");
		await store.get("foo");
		await store.get("missing");
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
		await store.set("foo", "bar");
		await store.get("foo");
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
		await store.set("user1", { name: "Alice", age: 30 });
		await store.set("user2", { name: "Bob", age: 25 });

		const getResult = await store.get("user1");
		expect(getResult).toBeDefined();
		expect(getResult?.name).toBe("Alice");
		expect(getResult?.age).toBe(30);

		const mgetResult = await store.mget(["user1", "user2"]);
		const user1 = mgetResult.user1;
		expect(user1).toBeDefined();
		expect(user1?.name).toBe("Alice");
		expect(user1?.age).toBe(30);

		const taken = await store.take("user2");
		expect(taken).toBeDefined();
		expect(taken?.name).toBe("Bob");
		expect(taken?.age).toBe(25);

		// Verify take removed the key
		const afterTake = await store.get("user2");
		expect(afterTake).toBeUndefined();
	});
});
