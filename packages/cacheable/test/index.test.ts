import { createWrapKey, type GetOrSetOptions } from "@cacheable/memoize";
import KeyvRedis from "@keyv/redis";
import { Keyv } from "keyv";
import { LRUCache } from "lru-cache";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	Cacheable,
	CacheableEvents,
	CacheableHooks,
	KeyvCacheableMemory,
} from "../src/index.js";
import { sleep } from "./sleep.js";

describe("cacheable options and properties", async () => {
	test("should be able to instantiate", async () => {
		const cacheable = new Cacheable();
		expect(cacheable).toBeDefined();
	});
	test("should enable nonBlocking on options", async () => {
		const cacheable = new Cacheable({ nonBlocking: true });
		expect(cacheable.nonBlocking).toEqual(true);
		cacheable.nonBlocking = false;
		expect(cacheable.nonBlocking).toEqual(false);
	});
	test("should be able to set the secondary", async () => {
		const cacheable = new Cacheable({ secondary: new Keyv() });
		expect(cacheable.secondary).toBeDefined();
		cacheable.secondary = new Keyv();
		expect(cacheable.secondary).toBeDefined();
	});
	test("should be able to set the primary", async () => {
		const cacheable = new Cacheable({ primary: new Keyv() });
		expect(cacheable.primary).toBeDefined();
		cacheable.primary = new Keyv();
		expect(cacheable.primary).toBeDefined();
	});
	test("should be able to set a random cache instance", async () => {
		const lruOptions = { max: 100 };
		const keyv = new Keyv({ store: new LRUCache(lruOptions) });
		const cacheable = new Cacheable({ primary: keyv });
		expect(cacheable.primary).toBeDefined();
		expect(cacheable.secondary).toBeUndefined();
		const setResult = await cacheable.set("key", "value");
		expect(setResult).toEqual(true);
		const getResult = await cacheable.get("key");
		expect(getResult).toEqual("value");
	});
	test("should be able to set primary KeyvStorageAdapter", async () => {
		const primary = new KeyvRedis("redis://localhost:6379");
		const cacheable = new Cacheable({ primary });
		const key = "key12345-opt";
		expect(cacheable.primary).toBeDefined();
		const setResult = await cacheable.set(key, "value");
		expect(setResult).toEqual(true);
		const getResult = await cacheable.get(key);
		expect(getResult).toEqual("value");
		await cacheable.delete(key);
		const getResult2 = await cacheable.get(key);
		expect(getResult2).toBeUndefined();
	});

	test("should be able to set secondary KeyvStorageAdapter", async () => {
		const secondary = new KeyvRedis("redis://localhost:6379");
		const cacheable = new Cacheable({ secondary });
		const key = "key12345-optsec";
		expect(cacheable.primary).toBeDefined();
		const setResult = await cacheable.set(key, "value");
		expect(setResult).toEqual(true);
		const getResult = await cacheable.get(key);
		expect(getResult).toEqual("value");
	});

	test("should be able to set ttl default", async () => {
		const cacheable = new Cacheable({ ttl: 1000 });
		expect(cacheable.ttl).toEqual(1000);
		cacheable.ttl = 2000;
		expect(cacheable.ttl).toEqual(2000);
	});
	test("should be able to set ttl on options", async () => {
		const cacheable = new Cacheable({ ttl: "10ms" });
		expect(cacheable.ttl).toEqual("10ms");
		cacheable.ttl = 2000;
		expect(cacheable.ttl).toEqual(2000);
	});
	test("setting the ttl to undefined or 0 should turn off the ttl", async () => {
		const cacheable = new Cacheable({ ttl: 1000 });
		expect(cacheable.ttl).toEqual(1000);
		cacheable.ttl = undefined;
		expect(cacheable.ttl).toBeUndefined();
		cacheable.ttl = "1h";
		expect(cacheable.ttl).toEqual("1h");
		cacheable.ttl = 0;
		expect(cacheable.ttl).toEqual(undefined);
	});

	test("should be able to set the cacheId", async () => {
		const cacheable = new Cacheable({ cacheId: "test" });
		expect(cacheable.cacheId).toEqual("test");
		cacheable.cacheId = "test2";
		expect(cacheable.cacheId).toEqual("test2");
	});
});

describe("cacheable stats", async () => {
	test("should return stats", async () => {
		const cacheable = new Cacheable();
		const { stats } = cacheable;
		expect(stats.enabled).toBe(false);
	});
	test("should be able to enable stats", async () => {
		const cacheable = new Cacheable({ stats: true });
		expect(cacheable.stats.enabled).toBe(true);
		cacheable.stats.enabled = false;
		expect(cacheable.stats.enabled).toBe(false);
	});
});

describe("cacheable set method", async () => {
	test("should set a value", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key", "value");
		const result = await cacheable.get("key");
		expect(result).toEqual("value");
	});
	test("should throw on set", async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, "set").mockImplementation(async () => {
			throw new Error("get error");
		});

		let result = false;
		const cacheable = new Cacheable({ secondary: keyv });
		cacheable.on("error", (error) => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.set("key", "value");
		expect(result).toBe(true);
	});
	test("should set a value with ttl", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key", "value", 10);
		await sleep(20);
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});
	test("should handle BEFORE_SET and AFTER_SET hooks", async () => {
		const cacheable = new Cacheable();
		let beforeSet = false;
		let afterSet = false;
		cacheable.onHook(CacheableHooks.BEFORE_SET, async (item) => {
			beforeSet = true;
			item.value = "new value";
		});
		cacheable.onHook(CacheableHooks.AFTER_SET, async (item) => {
			afterSet = true;
			expect(item.value).toEqual("new value");
		});
		await cacheable.set("key", "value");
		expect(beforeSet).toBe(true);
		expect(afterSet).toBe(true);
	});
	test("should set the value in a non blocking way", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ nonBlocking: true, secondary });
		await cacheable.set("key", "value");
		const result = await cacheable.get("key");
		expect(result).toEqual("value");
	});
	test("should set the value on the secondary", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		await cacheable.set("key", "value");
		const result = await cacheable.get("key");
		expect(result).toEqual("value");
	});
	test("should set many values", async () => {
		const cacheable = new Cacheable();
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual(["value1", "value2"]);
	});
	test("should set value in a non blocking way", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ nonBlocking: true, secondary });
		const result = await cacheable.set("key", "value");
		expect(result).toEqual(true);
	});
	test("should set value in a blocking way", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ nonBlocking: false, secondary });
		const result = await cacheable.set("key", "value");
		expect(result).toEqual(true);
	});
	test("should set many values on secondary", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual(["value1", "value2"]);
	});
	test("should set many values on secondary non blocking", async () => {
		const secondary = new Keyv();
		const nonBlocking = true;
		const cacheable = new Cacheable({ nonBlocking, secondary });
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual(["value1", "value2"]);
	});
	test("should throw on setMany", async () => {
		const cacheable = new Cacheable();
		vi.spyOn(cacheable, "hook").mockImplementation(async () => {
			throw new Error("set error");
		});
		let result = false;
		cacheable.on("error", (error) => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		expect(result).toBe(true);
	});
});

describe("cacheable get method", async () => {
	test("should get a value", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key", "value");
		const result = await cacheable.get("key");
		expect(result).toEqual("value");
	});
	test("should get a raw data object", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("rawKey", "rawValue");
		const raw = await cacheable.get("rawKey", { raw: true });
		expect(raw).toHaveProperty("value", "rawValue");
		expect(raw).toHaveProperty("expires");
	});
	test("should throw on get", async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, "get").mockImplementation(async () => {
			throw new Error("get error");
		});

		let result = false;
		const cacheable = new Cacheable({ secondary: keyv });
		cacheable.on("error", (error) => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.get("key");
		expect(result).toBe(true);
	});
	test("should handle BEFORE_GET and AFTER_GET hooks", async () => {
		const cacheable = new Cacheable();
		let beforeGet = false;
		let afterGet = false;
		cacheable.onHook(CacheableHooks.BEFORE_GET, async (key) => {
			beforeGet = true;
			expect(key).toEqual("key");
		});
		cacheable.onHook(CacheableHooks.AFTER_GET, async (item) => {
			afterGet = true;
			expect(item.key).toEqual("key");
			expect(item.result).toEqual("value");
		});
		await cacheable.set("key", "value");
		await cacheable.get("key");
		expect(beforeGet).toBe(true);
		expect(afterGet).toBe(true);
	});
	test("should get a value from secondary", async () => {
		const keyv = new Keyv();
		await keyv.set("key", "value");
		const cacheable = new Cacheable({ secondary: keyv });
		const result = await cacheable.get("key");
		expect(result).toEqual("value");
	});
	test("should get many values", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual(["value1", "value2"]);
	});
	test("should get raw data objects with getMany", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("rawKey1", "value1");
		await cacheable.set("rawKey2", "value2");
		const raws = await cacheable.getMany(["rawKey1", "rawKey2"], { raw: true });
		expect(raws).toHaveLength(2);
		expect(raws[0]).toHaveProperty("value", "value1");
		expect(raws[0]).toHaveProperty("expires");
		expect(raws[1]).toHaveProperty("value", "value2");
		expect(raws[1]).toHaveProperty("expires");
	});
	test("should throw on getMany", async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, "get").mockImplementation(async () => {
			throw new Error("get error");
		});

		let result = false;
		const cacheable = new Cacheable({ primary: keyv });
		cacheable.on("error", (error) => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.getMany(["key1", "key2"]);
		expect(result).toBe(true);
	});
	test("should get many values from secondary", async () => {
		const keyv = new Keyv();
		const cacheable = new Cacheable({ secondary: keyv });
		await cacheable.secondary?.set("key1", "value1");
		await cacheable.secondary?.set("key2", "value2");
		const secondaryResult = await cacheable.secondary?.get(["key1", "key2"]);
		expect(secondaryResult).toEqual(["value1", "value2"]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual(["value1", "value2"]);
		const primaryResult = await cacheable.primary.get<string>("key1");
		expect(primaryResult).toEqual("value1");
	});

	test("should no values from secondary secondary", async () => {
		const keyv = new Keyv();
		const cacheable = new Cacheable({ secondary: keyv });
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual(["value1", "value2"]);
		const result2 = await cacheable.getMany(["key1", "key4"]);
		expect(result2).toEqual(["value1", undefined]);
	});
});

describe("cacheable has method", async () => {
	test("should check if key exists and return false", async () => {
		const cacheable = new Cacheable();
		const result = await cacheable.has("key");
		expect(result).toBe(false);
	});
	test("should check if key exists and return true", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key", "value");
		const result = await cacheable.has("key");
		expect(result).toBe(true);
	});
	test("should check if key exists on secondary", async () => {
		const keyv = new Keyv();
		await keyv.set("key", "value");
		const cacheable = new Cacheable({ secondary: keyv });
		const result = await cacheable.has("key");
		expect(result).toBe(true);
	});
	test("should has many keys", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");
		const result = await cacheable.hasMany(["key1", "key2", "key3"]);
		expect(result).toEqual([true, true, false]);
	});
	test("should has many keys on secondary", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		await cacheable.secondary?.set("key3", "value3");
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");
		const result = await cacheable.hasMany(["key1", "key2", "key3"]);
		expect(result).toEqual([true, true, true]);
	});
});

describe("cacheable delete method", async () => {
	test("should delete a key", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key", "value");
		await cacheable.delete("key");
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});
	test("should delete a key on secondary", async () => {
		const keyv = new Keyv();
		await keyv.set("key", "value");
		const cacheable = new Cacheable({ secondary: keyv });
		await cacheable.delete("key");
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});
	test("should delete keys non blocking", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ nonBlocking: true, secondary });
		await cacheable.set("key", "value");
		await cacheable.delete("key");
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});
	test("should delete many keys", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");
		await cacheable.deleteMany(["key1", "key2"]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual([undefined, undefined]);
	});
	test("should delete many keys on secondary", async () => {
		const keyv = new Keyv();
		const cacheable = new Cacheable({ secondary: keyv });
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");
		await cacheable.deleteMany(["key1", "key2"]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual([undefined, undefined]);
	});
	test("should delete many keys on secondary non blocking", async () => {
		const keyv = new Keyv();
		const nonBlocking = true;
		const cacheable = new Cacheable({ nonBlocking, secondary: keyv });
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");
		await cacheable.deleteMany(["key1", "key2"]);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual([undefined, undefined]);
	});
});

describe("cacheable take method", async () => {
	test("should take a value", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key", "value");
		const result = await cacheable.take("key");
		expect(result).toEqual("value");
		const result2 = await cacheable.get("key");
		expect(result2).toBeUndefined();
	});
	test("should take many values", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");
		const result = await cacheable.takeMany(["key1", "key2"]);
		expect(result).toEqual(["value1", "value2"]);
		const result2 = await cacheable.getMany(["key1", "key2"]);
		expect(result2).toEqual([undefined, undefined]);
	});
});

describe("cacheable clear method", async () => {
	test("should clear the cache", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		await cacheable.set("key", "value");
		await cacheable.clear();
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});
	test("should clear the cache", async () => {
		const secondary = new Keyv();
		const nonBlocking = true;
		const cacheable = new Cacheable({ nonBlocking, secondary });
		await cacheable.set("key", "value");
		await cacheable.clear();
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});
});

describe("cacheable disconnect method", async () => {
	test("should disconnect the cache", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		let primaryDisconnected = false;
		let secondaryDisconnected = false;
		vi.spyOn(primary, "disconnect").mockImplementation(async () => {
			primaryDisconnected = true;
		});
		vi.spyOn(secondary, "disconnect").mockImplementation(async () => {
			secondaryDisconnected = true;
		});
		const cacheable = new Cacheable({ primary, secondary });
		await cacheable.disconnect();
		expect(primaryDisconnected).toBe(true);
		expect(secondaryDisconnected).toBe(true);
	});
	test("should disconnect the cache non blocking", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const nonBlocking = true;
		let primaryDisconnected = false;
		let secondaryDisconnected = false;
		vi.spyOn(primary, "disconnect").mockImplementation(async () => {
			primaryDisconnected = true;
		});
		vi.spyOn(secondary, "disconnect").mockImplementation(async () => {
			secondaryDisconnected = true;
		});
		const cacheable = new Cacheable({ nonBlocking, primary, secondary });
		await cacheable.disconnect();
		expect(primaryDisconnected).toBe(true);
		expect(secondaryDisconnected).toBe(true);
	});
});

describe("cacheable stats enabled", async () => {
	test("should increment set stats", async () => {
		const cacheable = new Cacheable({ stats: true });
		await cacheable.set("key", "value");
		expect(cacheable.stats.sets).toBe(1);
	});
	test("should increment get stats", async () => {
		const cacheable = new Cacheable({ stats: true });
		await cacheable.get("key");
		expect(cacheable.stats.gets).toBe(1);
		expect(cacheable.stats.misses).toBe(1);
		expect(cacheable.stats.hits).toBe(0);
	});
	test("should increment hit stats on get", async () => {
		const cacheable = new Cacheable({ stats: true });
		await cacheable.set("key", "value");
		await cacheable.get("key");
		expect(cacheable.stats.hits).toBe(1);
	});
	test("should handle get many stats", async () => {
		const cacheable = new Cacheable({ stats: true });
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual([undefined, undefined]);
		expect(cacheable.stats.gets).toBe(1);
		expect(cacheable.stats.misses).toBe(2);
		expect(cacheable.stats.hits).toBe(0);
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		const result2 = await cacheable.getMany(["key1", "key2"]);
		expect(result2).toEqual(["value1", "value2"]);
		expect(cacheable.stats.gets).toBe(2);
		expect(cacheable.stats.misses).toBe(2);
		expect(cacheable.stats.hits).toBe(2);
	});
	test("should get stats on delete", async () => {
		const cacheable = new Cacheable({ stats: true });
		await cacheable.set("key", "value");
		await cacheable.delete("key");
		expect(cacheable.stats.deletes).toBe(1);
		expect(cacheable.stats.count).toBe(0);
	});
	test("should get stats on delete many", async () => {
		const cacheable = new Cacheable({ stats: true });
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		await cacheable.deleteMany(["key1", "key2"]);
		expect(cacheable.stats.deletes).toBe(2);
		expect(cacheable.stats.count).toBe(0);
	});
	test("should get stats on clear", async () => {
		const cacheable = new Cacheable({ stats: true });
		await cacheable.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		expect(cacheable.stats.count).toBe(2);
		expect(cacheable.stats.ksize).toBeGreaterThan(0);
		expect(cacheable.stats.vsize).toBeGreaterThan(0);
		await cacheable.clear();
		expect(cacheable.stats.count).toBe(0);
		expect(cacheable.stats.clears).toBe(1);
		expect(cacheable.stats.vsize).toBe(0);
		expect(cacheable.stats.ksize).toBe(0);
	});
});

describe("cacheable ttl parsing", async () => {
	test("set the default ttl", async () => {
		const cacheable = new Cacheable({ ttl: "2ms" });
		expect(cacheable.ttl).toEqual("2ms");
		await cacheable.set("key", "value");
		const firstResult = await cacheable.get("key");
		expect(firstResult).toEqual("value");
		await sleep(5);
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});
	test("set the default ttl with number", async () => {
		const cacheable = new Cacheable({ ttl: 2 });
		expect(cacheable.ttl).toEqual(2);
		await cacheable.set("key", "value");
		const firstResult = await cacheable.get("key");
		expect(firstResult).toEqual("value");
		await sleep(5);
		const result = await cacheable.get("key");
		expect(result).toBeUndefined();
	});

	test("setMany without ttl", async () => {
		const cacheable = new Cacheable({ ttl: 50 });
		const list = [
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		];
		await cacheable.setMany(list);
		const firstResult = await cacheable.getMany(["key1", "key2"]);
		expect(firstResult).toEqual(["value1", "value2"]);
		await sleep(100);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual([undefined, undefined]);
	});

	test("setMany with ttl", async () => {
		const cacheable = new Cacheable({ ttl: 2 });
		const list = [
			{ key: "key1", value: "value1", ttl: "30s" },
			{ key: "key2", value: "value2" },
		];
		await cacheable.setMany(list);
		const firstResult = await cacheable.getMany(["key1", "key2"]);
		expect(firstResult).toEqual(["value1", "value2"]);
		await sleep(5);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual(["value1", undefined]);
	});

	test("setMany with ttl number", async () => {
		const cacheable = new Cacheable({ ttl: 2 });
		const list = [
			{ key: "key1", value: "value1", ttl: 30 },
			{ key: "key2", value: "value2", ttl: "1h" },
		];
		await cacheable.setMany(list);
		const firstResult = await cacheable.getMany(["key1", "key2"]);
		expect(firstResult).toEqual(["value1", "value2"]);
		await sleep(35);
		const result = await cacheable.getMany(["key1", "key2"]);
		expect(result).toEqual([undefined, "value2"]);
	});
});

describe("cacheable hash method", async () => {
	test("should hash an object", async () => {
		const cacheable = new Cacheable();
		const result = cacheable.hash({ foo: "bar" });
		expect(result).toEqual(
			"7a38bf81f383f69433ad6e900d35b3e2385593f76a7b7ab5d4355b8ba41ee24b",
		);
	});
});

describe("cacheable wrap", async () => {
	test("should wrap method with key and ttl", async () => {
		const cacheable = new Cacheable();
		const asyncFunction = async (value: number) => Math.random() * value;
		const options = {
			keyPrefix: "keyPrefix",
			ttl: 10,
		};

		const wrapped = cacheable.wrap(asyncFunction, options);
		const result = await wrapped(1);
		const result2 = await wrapped(1);
		expect(result).toBe(result2);
		const cacheKey = createWrapKey(asyncFunction, [1], options.keyPrefix);
		const cacheResult1 = await cacheable.get(cacheKey);
		expect(cacheResult1).toBe(result);
		await sleep(20);
		const cacheResult2 = await cacheable.get(cacheKey);
		expect(cacheResult2).toBeUndefined();
	});
	test("wrap async function", async () => {
		const cache = new Cacheable();
		const options = {
			keyPrefix: "wrapPrefix",
			ttl: "5m",
		};

		const plus = async (a: number, b: number) => a + b;
		const plusCached = cache.wrap(plus, options);

		const multiply = async (a: number, b: number) => a * b;
		const multiplyCached = cache.wrap(multiply, options);

		const result1 = await plusCached(1, 2);
		const result2 = await multiplyCached(1, 2);

		expect(result1).toBe(3);
		expect(result2).toBe(2);
	});

	test("should wrap to default ttl", async () => {
		const cacheable = new Cacheable({ ttl: 10 });
		const asyncFunction = async (value: number) => Math.random() * value;
		const options = {
			keyPrefix: "wrapPrefix",
		};
		const wrapped = cacheable.wrap(asyncFunction, options);
		const result = await wrapped(1);
		const result2 = await wrapped(1);
		expect(result).toBe(result2); // Cached
		await sleep(15);
		const result3 = await wrapped(1);
		expect(result3).not.toBe(result2);
	});

	test("Cacheable.wrap() passes createKey option through", async () => {
		const cacheable = new Cacheable();
		let createKeyCalled = false;
		const asyncFunction = async (argument: string) => `Result for ${argument}`;
		const options = {
			createKey: () => {
				createKeyCalled = true;
				return "testKey";
			},
		};

		const wrapped = cacheable.wrap(asyncFunction, options);
		await wrapped("arg1");
		expect(createKeyCalled).toBe(true);
	});
});

describe("cacheable namespace", async () => {
	test("should set the namespace via options", async () => {
		const cacheable = new Cacheable({ namespace: "test" });
		expect(cacheable.namespace).toBe("test");
	});
	test("should set the namespace via function", async () => {
		const cacheable = new Cacheable({ namespace: () => "test" });
		expect(cacheable.getNameSpace()).toBe("test");
	});
	test("should set the secondary namespace", async () => {
		const cacheable = new Cacheable({
			secondary: new Keyv(),
			namespace: "test",
		});
		expect(cacheable.namespace).toBe("test");
	});
	test("should set the secondary namspace when setting property", async () => {
		const cacheable = new Cacheable({ secondary: new Keyv() });
		cacheable.namespace = "test";
		expect(cacheable.secondary?.namespace).toBe("test");
	});
});

describe("cacheable get or set", () => {
	test("should cache results", async () => {
		const cacheable = new Cacheable();
		const function_ = vi.fn(async () => 1 + 2);
		const result = await cacheable.getOrSet("one_plus_two", function_);
		await cacheable.getOrSet("one_plus_two", function_);
		expect(result).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});
	test("should prevent stampede", async () => {
		const cacheable = new Cacheable();
		const function_ = vi.fn(async () => 42);
		await Promise.all([
			cacheable.getOrSet("key1", function_),
			cacheable.getOrSet("key1", function_),
			cacheable.getOrSet("key2", function_),
			cacheable.getOrSet("key2", function_),
		]);
		expect(function_).toHaveBeenCalledTimes(2);
	});
	test("should throw on getOrSet error", async () => {
		const cacheable = new Cacheable();
		const function_ = vi.fn(async () => {
			throw new Error("Test error");
		});
		let errorCaught = false;
		cacheable.on("error", () => {
			errorCaught = true;
		});

		await expect(
			cacheable.getOrSet("key", function_, { throwErrors: true }),
		).rejects.toThrow("Test error");
		expect(errorCaught).toBe(true);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test("should generate key via function on getOrSet", async () => {
		const cacheable = new Cacheable();
		const generateKey = (options?: GetOrSetOptions) =>
			`custom_key_${options?.cacheId}`;
		const function_ = vi.fn(async () => Math.random() * 100);
		const result1 = await cacheable.getOrSet(generateKey, function_);
		const result2 = await cacheable.getOrSet(generateKey, function_);
		expect(result1).toBe(result2);
	});
});

describe("cacheable events", async () => {
	test("should emit cache:hit event when getting value from primary store", async () => {
		const cacheable = new Cacheable();
		const events: Array<{ key: string; value: unknown; store: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			events.push(event);
		});

		await cacheable.set("test-key", "test-value");
		const value = await cacheable.get("test-key");

		expect(value).toBe("test-value");
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			key: "test-key",
			value: "test-value",
			store: "primary",
		});
	});

	test("should emit cache:hit event when getting value from secondary store", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const events: Array<{ key: string; value: unknown; store: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			events.push(event);
		});

		// Set directly in secondary store
		await secondary.set("test-key2", "secondary-value");

		// Get should retrieve from secondary and emit event
		const value = await cacheable.get("test-key2");

		expect(value).toBe("secondary-value");
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			key: "test-key2",
			value: "secondary-value",
			store: "secondary",
		});

		// Verify it was copied to primary
		const primaryValue = await cacheable.primary.get("test-key2");
		expect(primaryValue).toBe("secondary-value");
	});

	test("should emit cache:miss event when key not found", async () => {
		const cacheable = new Cacheable();
		const events: Array<{ key: string; store?: string }> = [];

		cacheable.on(CacheableEvents.CACHE_MISS, (event) => {
			events.push(event);
		});

		const value = await cacheable.get("non-existent-key");

		expect(value).toBeUndefined();
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			key: "non-existent-key",
			store: "primary",
		});
	});

	test("should emit cache:miss for both stores when key not found", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const events: Array<{ key: string; store?: string }> = [];

		cacheable.on(CacheableEvents.CACHE_MISS, (event) => {
			events.push(event);
		});

		const value = await cacheable.get("non-existent-key");

		expect(value).toBeUndefined();
		expect(events).toHaveLength(2);
		expect(events[0]).toEqual({
			key: "non-existent-key",
			store: "primary",
		});
		expect(events[1]).toEqual({
			key: "non-existent-key",
			store: "secondary",
		});
	});

	test("should emit cache:hit and cache:miss events in getMany", async () => {
		const cacheable = new Cacheable();
		const hitEvents: Array<{ key: string; value: unknown; store: string }> = [];
		const missEvents: Array<{ key: string; store?: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			hitEvents.push(event);
		});

		cacheable.on(CacheableEvents.CACHE_MISS, (event) => {
			missEvents.push(event);
		});

		// Set some keys
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");

		// Get multiple keys including some that don't exist
		const values = await cacheable.getMany(["key1", "key2", "key3", "key4"]);

		expect(values).toEqual(["value1", "value2", undefined, undefined]);

		// Check hit events
		expect(hitEvents).toHaveLength(2);
		expect(hitEvents[0]).toEqual({
			key: "key1",
			value: "value1",
			store: "primary",
		});
		expect(hitEvents[1]).toEqual({
			key: "key2",
			value: "value2",
			store: "primary",
		});

		// Check miss events - only primary store misses since no secondary
		expect(missEvents).toHaveLength(2);
		expect(missEvents[0]).toEqual({ key: "key3", store: "primary" });
		expect(missEvents[1]).toEqual({ key: "key4", store: "primary" });
	});

	test("should emit cache:hit event from secondary store in getMany", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const hitEvents: Array<{ key: string; value: unknown; store: string }> = [];
		const missEvents: Array<{ key: string; store?: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			hitEvents.push(event);
		});

		cacheable.on(CacheableEvents.CACHE_MISS, (event) => {
			missEvents.push(event);
		});

		// Set key only in secondary store
		await secondary.set("secondary-key", "secondary-value");

		// Get single key that only exists in secondary
		const values = await cacheable.getMany(["secondary-key"]);

		expect(values).toEqual(["secondary-value"]);

		// Should have one miss from primary and one hit from secondary
		expect(missEvents).toHaveLength(1);
		expect(missEvents[0]).toEqual({
			key: "secondary-key",
			store: "primary",
		});

		expect(hitEvents).toHaveLength(1);
		expect(hitEvents[0]).toEqual({
			key: "secondary-key",
			value: "secondary-value",
			store: "secondary",
		});
	});
});

describe("Non-blocking error handling", () => {
	let errorSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		errorSpy = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("should handle errors in non-blocking mode for set method", async () => {
		const primary = new Keyv({ store: new KeyvCacheableMemory() });
		const secondary = new Keyv();

		// Make secondary.set throw an error after a delay
		vi.spyOn(secondary, "set").mockImplementation(
			() =>
				new Promise((_, reject) => {
					setTimeout(() => reject(new Error("Secondary store error")), 10);
				}),
		);

		const cache = new Cacheable({ primary, secondary, nonBlocking: true });
		cache.on(CacheableEvents.ERROR, errorSpy);

		// This should succeed because primary works and we're in non-blocking mode
		const result = await cache.set("key1", "value1");
		expect(result).toBe(true);

		// Wait for the secondary store to fail
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Error should be emitted but not throw
		expect(errorSpy).toHaveBeenCalledWith(new Error("Secondary store error"));
	});

	test("should handle errors in non-blocking mode for setMany method", async () => {
		const primary = new Keyv({ store: new KeyvCacheableMemory() });
		const secondary = new Keyv();

		// Make secondary operations throw an error
		const mockSetMany = vi
			.fn()
			.mockRejectedValue(new Error("Secondary setMany error"));
		secondary.set = mockSetMany;

		const cache = new Cacheable({ primary, secondary, nonBlocking: true });
		cache.on(CacheableEvents.ERROR, errorSpy);

		const items = [
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		];

		// This should succeed because primary works
		const result = await cache.setMany(items);
		expect(result).toBe(true);

		// Wait for the error to be emitted
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Error should be emitted but not throw
		expect(errorSpy).toHaveBeenCalled();
		const errorArg = errorSpy.mock.calls[0][0];
		expect(errorArg).toBeInstanceOf(Error);
		expect(errorArg.message).toBe("Secondary setMany error");
	});

	test("should handle errors in non-blocking mode for delete method", async () => {
		const primary = new Keyv({ store: new KeyvCacheableMemory() });
		const secondary = new Keyv();

		// Set a value first
		await primary.set("key1", "value1");
		await secondary.set("key1", "value1");

		// Make secondary.delete throw an error after a delay
		vi.spyOn(secondary, "delete").mockImplementation(
			() =>
				new Promise((_, reject) => {
					setTimeout(() => reject(new Error("Secondary delete error")), 10);
				}),
		);

		const cache = new Cacheable({ primary, secondary, nonBlocking: true });
		cache.on(CacheableEvents.ERROR, errorSpy);

		// This should succeed because primary works and we're in non-blocking mode
		const result = await cache.delete("key1");
		expect(result).toBe(true);

		// Wait for the secondary store to fail
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Error should be emitted but not throw
		expect(errorSpy).toHaveBeenCalledWith(new Error("Secondary delete error"));
	});

	test("should handle errors in non-blocking mode for deleteMany method", async () => {
		const primary = new Keyv({ store: new KeyvCacheableMemory() });
		const secondary = new Keyv();

		// Set values first
		await primary.set("key1", "value1");
		await primary.set("key2", "value2");

		// Make secondary.delete throw an error
		vi.spyOn(secondary, "delete").mockRejectedValue(
			new Error("Secondary deleteMany error"),
		);

		const cache = new Cacheable({ primary, secondary, nonBlocking: true });
		cache.on(CacheableEvents.ERROR, errorSpy);

		// This should succeed because primary works
		const result = await cache.deleteMany(["key1", "key2"]);
		expect(result).toBe(true);

		// Wait for the error to be emitted
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Error should be emitted but not throw
		expect(errorSpy).toHaveBeenCalled();
		const errorArg = errorSpy.mock.calls[0][0];
		expect(errorArg).toBeInstanceOf(Error);
		expect(errorArg.message).toBe("Secondary deleteMany error");
	});

	test("multiple promises should all have error handlers in Promise.race", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();

		// Create promises that we can control
		vi.spyOn(primary, "set").mockImplementation(
			() =>
				new Promise((resolve) => {
					// Primary succeeds quickly
					setTimeout(() => resolve(true), 5);
				}),
		);

		vi.spyOn(secondary, "set").mockImplementation(
			() =>
				new Promise((_resolve, reject) => {
					// Secondary fails after primary succeeds
					setTimeout(
						() => reject(new Error("Secondary failed after race")),
						20,
					);
				}),
		);

		const cache = new Cacheable({ primary, secondary, nonBlocking: true });
		cache.on(CacheableEvents.ERROR, errorSpy);

		// This should succeed with the primary store
		const result = await cache.set("key1", "value1");
		expect(result).toBe(true);

		// Wait for secondary to fail
		await new Promise((resolve) => setTimeout(resolve, 50));

		// The error from the losing promise should be caught and emitted
		expect(errorSpy).toHaveBeenCalledWith(
			new Error("Secondary failed after race"),
		);
	});
});
