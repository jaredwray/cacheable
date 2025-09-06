import { faker } from "@faker-js/faker";
import { Keyv } from "keyv";
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
	test("should set a primary keyv store", () => {
		const store = new NodeCacheStore();
		expect(store.primary).toBeDefined();
		const keyv = new Keyv();
		store.primary = keyv;
		expect(store.primary).toBe(keyv);
	});
	test("should set a secondary keyv store", () => {
		const store = new NodeCacheStore();
		expect(store.secondary).toBeUndefined();
		const keyv = new Keyv();
		store.secondary = keyv;
		expect(store.secondary).toBe(keyv);
	});
	test("should be able to get and set primary and secondary keyv stores", async () => {
		const store = new NodeCacheStore();
		expect(store.primary).toBeDefined();
		expect(store.secondary).toBeUndefined();
		const primary = new Keyv();
		const secondary = new Keyv();
		store.primary = primary;
		store.secondary = secondary;
		expect(store.primary).toBe(primary);
		expect(store.secondary).toBe(secondary);
		await store.set("test", "value");
		const restult1 = await store.get("test");
		expect(restult1).toBe("value");
		await store.set("test", "value", 100);
		const restult2 = await store.get("test");
		expect(restult2).toBe("value");
		await sleep(200);
		const restult3 = await store.get("test");
		expect(restult3).toBeUndefined();
	});
	test("should set a maxKeys limit", async () => {
		const store = new NodeCacheStore({ maxKeys: 3 });
		expect(store.maxKeys).toBe(3);
		expect(store.cache.stats.enabled).toBe(true);
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
});
