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
	test("should create a new instance with options", () => {
		const store = new NodeCacheStore({ maxKeys: 100 });
		expect(store.maxKeys).toBe(100);
		store.maxKeys = 200;
		expect(store.maxKeys).toBe(200);
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
	test("should set a maxKeys limit", async () => {
		const store = new NodeCacheStore({ maxKeys: 3 });
		expect(store.maxKeys).toBe(3);
		await store.set("test1", "value1");
		await store.set("test2", "value2");
		await store.set("test3", "value3");
		await store.set("test4", "value4");
		const result1 = await store.get("test4");
		expect(result1).toBeUndefined();
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
	test("should not increment count when updating existing key with set", async () => {
		const store = new NodeCacheStore();
		await store.set("test", "value1");
		const stats1 = await store.store.get("test");
		expect(stats1).toBe("value1");

		// Update the same key
		await store.set("test", "value2");
		const stats2 = await store.store.get("test");
		expect(stats2).toBe("value2");

		// The count should still be 1, not 2
		// We can verify this by checking that a maxKeys of 1 still works
		const storeWithMax = new NodeCacheStore({ maxKeys: 1 });
		await storeWithMax.set("key1", "val1");
		const success1 = await storeWithMax.set("key1", "val1_updated");
		expect(success1).toBe(true);
		const result = await storeWithMax.get("key1");
		expect(result).toBe("val1_updated");
	});
	test("should not increment count when updating existing keys with mset", async () => {
		const store = new NodeCacheStore({ maxKeys: 2 });

		// Add 2 keys
		await store.mset([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);

		// Update the same keys - should not fail even with maxKeys = 2
		await store.mset([
			{ key: "key1", value: "updated1" },
			{ key: "key2", value: "updated2" },
		]);

		const result1 = await store.get("key1");
		const result2 = await store.get("key2");
		expect(result1).toBe("updated1");
		expect(result2).toBe("updated2");

		// Try to add a third key - should work because count is still 2
		await store.set("key3", "value3");
		const result3 = await store.get("key3");
		expect(result3).toBeUndefined(); // Should fail because we're at maxKeys
	});
});
