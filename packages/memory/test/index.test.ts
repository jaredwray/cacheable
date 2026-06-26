import { createWrapKey, HashAlgorithm, sleep } from "@cacheable/utils";
import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";
import { CacheableMemory, CacheableMemoryHooks } from "../src/index.js";

const cacheItemList = [
	{ key: "key", value: "value" },
	{ key: "key1", value: { foo: "bar" } },
	{ key: "key2", value: 123, ttl: 10 },
	{ key: "key3", value: [1, 2, 3] },
	{ key: "key4", value: "value4", ttl: "5m" },
];

describe("CacheableMemory Options and Properties", () => {
	test("should have default ttl", () => {
		const cache = new CacheableMemory();
		expect(cache.ttl).toBe(undefined);
	});
	test("should be able to set ttl", () => {
		const cache = new CacheableMemory({ ttl: 5 });
		expect(cache.ttl).toBe(5);
		cache.ttl = 1000;
		expect(cache.ttl).toBe(1000);
	});
	test("should handle negative ttl as undefined", () => {
		const cache = new CacheableMemory({ ttl: -1 });
		expect(cache.ttl).toBe(undefined);
		cache.ttl = "1s";
		expect(cache.ttl).toBe("1s");
		cache.ttl = undefined;
		expect(cache.ttl).toBe(undefined);
	});
	test("should be able to set the hash store size", () => {
		const cache = new CacheableMemory({ storeHashSize: 100 });
		expect(cache.storeHashSize).toBe(100);
		cache.storeHashSize = 200;
		expect(cache.storeHashSize).toBe(200);
	});

	test("should be able to set the storeHashSize", () => {
		const cache = new CacheableMemory({ storeHashSize: 100 });
		expect(cache.storeHashSize).toBe(100);
		cache.storeHashSize = 200;
		expect(cache.storeHashSize).toBe(200);
	});

	test("should be able to get the store via property", () => {
		const cache = new CacheableMemory();
		const { store } = cache;
		expect(store).toBeInstanceOf(Array);
	});

	test("storeHashSize cannot be 0", () => {
		const cache = new CacheableMemory({ storeHashSize: 0 });
		expect(cache.storeHashSize).toBe(16); // Default size
	});

	test("should be able to set the storeHashAlgorithm", () => {
		const cache = new CacheableMemory({
			storeHashAlgorithm: HashAlgorithm.DJB2,
		});
		expect(cache.storeHashAlgorithm).toBe(HashAlgorithm.DJB2);
		cache.storeHashAlgorithm = HashAlgorithm.FNV1;
		expect(cache.storeHashAlgorithm).toBe(HashAlgorithm.FNV1);

		const data1 = {
			key: faker.string.alphanumeric(10),
			value: faker.string.alphanumeric(10),
		};

		const data2 = {
			key: faker.string.alphanumeric(10),
			value: faker.string.alphanumeric(10),
		};

		cache.set(data1.key, data1.value);
		cache.set(data2.key, data2.value);

		expect(cache.get(data1.key)).toBe(data1.value);
		expect(cache.get(data2.key)).toBe(data2.value);
	});

	test("should be able to set the storeHashAlgorithm murmer", () => {
		const cache = new CacheableMemory({
			storeHashAlgorithm: HashAlgorithm.MURMER,
		});
		expect(cache.storeHashAlgorithm).toBe(HashAlgorithm.MURMER);

		const data1 = {
			key: faker.string.alphanumeric(10),
			value: faker.string.alphanumeric(10),
		};

		const data2 = {
			key: faker.string.alphanumeric(10),
			value: faker.string.alphanumeric(10),
		};

		cache.set(data1.key, data1.value);
		cache.set(data2.key, data2.value);

		expect(cache.get(data1.key)).toBe(data1.value);
		expect(cache.get(data2.key)).toBe(data2.value);
	});

	test("should be able to set storeHashAlgorithm to function", () => {
		const customHashFunction = (key: string) =>
			key.split("").reduce((hash, char) => hash + char.charCodeAt(0), 0);
		const cache = new CacheableMemory({
			storeHashAlgorithm: customHashFunction,
		});
		expect(cache.storeHashAlgorithm).toBe(customHashFunction);
		const data1 = {
			key: faker.string.alphanumeric(10),
			value: faker.string.alphanumeric(10),
		};

		const data2 = {
			key: faker.string.alphanumeric(10),
			value: faker.string.alphanumeric(10),
		};

		cache.set(data1.key, data1.value);
		cache.set(data2.key, data2.value);
		expect(cache.get(data1.key)).toBe(data1.value);
		expect(cache.get(data2.key)).toBe(data2.value);
	});
});

describe("CacheableMemory Store", () => {
	test("should be able to get size", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		cache.set("key1", "value");
		cache.set("key2", "value");
		cache.set("key3", "value");
		cache.set("key4", "value");
		expect(cache.size).toBe(5);
	});

	test("should be able to set the size of the store to 1", () => {
		const cache = new CacheableMemory({ storeHashSize: 1 });
		cache.set("key", "value");
		expect(cache.size).toBe(1);
		cache.set("key1", "value1");
		expect(cache.size).toBe(2);
		const value = cache.get("key");
		expect(value).toBe("value");
		const value1 = cache.get("key1");
		expect(value1).toBe("value1");
	});

	test("should be able to get keys", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		cache.set("key1", "value");
		cache.set("key2", "value");
		cache.set("key3", "value");
		cache.set("key4", "value");
		const keys = [...cache.keys];
		expect(keys).toContain("key");
		expect(keys).toContain("key1");
		expect(keys).toContain("key2");
		expect(keys).toContain("key3");
		expect(keys).toContain("key4");
	});

	test("should be able to get keys that are not expired", async () => {
		const cache = new CacheableMemory();
		cache.set("key", "value", 1);
		cache.set("key1", "value");
		cache.set("key2", "value");
		cache.set("key3", "value");
		cache.set("key4", "value");
		await sleep(5);
		const keys = [...cache.keys];
		expect(keys).not.toContain("key");
		expect(keys).toContain("key1");
		expect(keys).toContain("key2");
		expect(keys).toContain("key3");
		expect(keys).toContain("key4");
	});

	test("should be able to get values", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");
		cache.set("key4", "value4");
		const values = [...cache.items];
		expect(values.length).toBe(5);
		expect(values.find((item) => item.value === "value")?.value).toBe("value");
		expect(values.find((item) => item.value === "value1")?.value).toBe(
			"value1",
		);
		expect(values.find((item) => item.value === "value2")?.value).toBe(
			"value2",
		);
		expect(values.find((item) => item.value === "value3")?.value).toBe(
			"value3",
		);
		expect(values.find((item) => item.value === "value4")?.value).toBe(
			"value4",
		);
	});

	test("should be able to get values not expired", async () => {
		const cache = new CacheableMemory();
		cache.set("key", "value", 1);
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");
		cache.set("key4", "value4");
		await sleep(5);
		const values = [...cache.items];
		expect(
			values.find((item) => item.value === "value")?.value,
		).toBeUndefined();
		expect(values.find((item) => item.value === "value1")?.value).toBe(
			"value1",
		);
		expect(values.find((item) => item.value === "value2")?.value).toBe(
			"value2",
		);
		expect(values.find((item) => item.value === "value3")?.value).toBe(
			"value3",
		);
		expect(values.find((item) => item.value === "value4")?.value).toBe(
			"value4",
		);
	});

	test("should be able to iterate over cache items", () => {
		const cache = new CacheableMemory();
		const list = [];

		for (let i = 0; i < 5; i++) {
			list.push({
				key: faker.string.alphanumeric(5),
				value: faker.string.alphanumeric(5),
			});
		}

		cache.setMany(list);

		const itemResultList = [];

		for (const item of cache.items) {
			expect(item).toBeDefined();
			itemResultList.push(item);
		}

		expect(itemResultList.length).toBe(5);
	});

	test("should not reset the store when setting the same size", () => {
		const cache = new CacheableMemory({ storeHashSize: 5 });
		cache.setMany(cacheItemList);
		expect(cache.size).toBe(5);
		cache.storeHashSize = 5; // Setting the same size should not reset the store
		expect(cache.size).toBe(5);
	});

	test("should be able to set clone", () => {
		const cache = new CacheableMemory({ useClone: true });
		expect(cache.useClone).toBe(true);
		cache.useClone = false;
		expect(cache.useClone).toBe(false);
	});

	test("lruSize should be 0 by default", () => {
		const cache = new CacheableMemory();
		expect(cache.lruSize).toBe(0);
	});

	test("should be able to set lruSize", () => {
		const cache = new CacheableMemory({ lruSize: 15 });
		expect(cache.lruSize).toBe(15);
		cache.lruSize = 5;
		expect(cache.lruSize).toBe(5);
	});
});

describe("CacheableMemory Set", async () => {
	test("should set many values", async () => {
		const cache = new CacheableMemory();
		const list = [
			{ key: "key", value: "value" },
			{ key: "key1", value: { foo: "bar" } },
			{ key: "key2", value: 123, ttl: 10 },
			{ key: "key3", value: [1, 2, 3] },
		];
		cache.setMany(list);
		expect(cache.get("key")).toBe("value");
		expect(cache.get("key1")).toEqual({ foo: "bar" });
		expect(cache.get("key2")).toBe(123);
		expect(cache.get("key3")).toEqual([1, 2, 3]);
		await sleep(20);
		expect(cache.get("key2")).toBe(undefined);
	});
});

describe("CacheableMemory Get", async () => {
	test("should set and get value", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		expect(cache.get("key")).toBe("value");
	});
	test("should be able to get undefined value", () => {
		const cache = new CacheableMemory();
		expect(cache.get("key")).toBe(undefined);
	});
	test("should not be able to get expired value", async () => {
		const cache = new CacheableMemory();
		cache.set("key", "value", 1);
		await sleep(20);
		expect(cache.get("key")).toBe(undefined);
	});
	test("should not be able to get expired value with default ttl", async () => {
		const cache = new CacheableMemory({ ttl: 1 });
		cache.set("key", "value");
		await sleep(20);
		expect(cache.get("key")).toBe(undefined);
	});
	test("should be able to get a clone of the value", () => {
		const cache = new CacheableMemory();
		expect(cache.useClone).toBe(true);
		cache.set("key", { value: "value" });

		const value = cache.get("key");
		expect(value).toEqual({ value: "value" });
	});
	test("should be able to get the value without cloning", () => {
		const cache = new CacheableMemory({ useClone: false });
		expect(cache.useClone).toBe(false);
		const value = { value: "value" };
		cache.set("key", value);

		const value2 = cache.get("key");
		expect(value).toEqual(value2);
	});
	test("should be able to get many values", async () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		await sleep(20);
		const result = cache.getMany(["key", "key1", "key2", "key3", "key4"]);
		expect(result[0]).toBe("value");
		expect(result[1]).toEqual({ foo: "bar" });
		expect(result[2]).toBe(undefined);
		expect(result[3]).toEqual([1, 2, 3]);
		expect(result[4]).toBe("value4");
	});
});

describe("CacheableMemory getRaw", async () => {
	test("should set and get raw value", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		expect(cache.getRaw("key")?.value).toBe("value");
	});
	test("should be able to get undefined raw value", () => {
		const cache = new CacheableMemory();
		expect(cache.getRaw("key")).toBe(undefined);
	});
	test("should not be able to get expired raw value", async () => {
		const cache = new CacheableMemory();
		cache.set("key", "value", 1);
		await sleep(20);
		expect(cache.getRaw("key")).toBe(undefined);
	});
	test("should be able to get many raw values", () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		const result = cache.getManyRaw(["key", "key1", "key2", "key3", "key4"]);
		expect(result[0]?.value).toBe("value");
		expect(result[1]?.value).toEqual({ foo: "bar" });
		expect(result[2]?.value).toBe(123);
		expect(result[3]?.value).toEqual([1, 2, 3]);
		expect(result[4]?.value).toBe("value4");
	});
});

describe("CacheableMemory Has", async () => {
	test("should return true if key exists", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		expect(cache.has("key")).toBe(true);
	});
	test("should return false if key does not exist", () => {
		const cache = new CacheableMemory();
		expect(cache.has("key")).toBe(false);
	});
	test("should return for many keys", () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		const result = cache.hasMany(["key", "key1", "key2", "key3"]);
		expect(result[0]).toBe(true);
		expect(result[1]).toBe(true);
		expect(result[2]).toBe(true);
		expect(result[3]).toBe(true);
	});
});

describe("CacheableMemory Take", async () => {
	test("should set and take value", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		expect(cache.take("key")).toBe("value");
		expect(cache.get("key")).toBe(undefined);
	});
	test("should be able to take undefined value", () => {
		const cache = new CacheableMemory();
		expect(cache.take("key")).toBe(undefined);
	});
	test("should be able to take many values", () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		const result = cache.takeMany(["key", "key1"]);
		expect(result[0]).toBe("value");
		expect(result[1]).toEqual({ foo: "bar" });
		expect(cache.get("key")).toBe(undefined);
		expect(cache.get("key1")).toBe(undefined);
		expect(cache.get("key2")).toBe(123);
		expect(cache.get("key3")).toEqual([1, 2, 3]);
		expect(cache.get("key4")).toBe("value4");
	});
});

describe("CacheableMemory Delete", async () => {
	test("should set and delete value", () => {
		const cache = new CacheableMemory();
		cache.set("key", "value");
		cache.delete("key");
		expect(cache.get("key")).toBe(undefined);
	});
	test("should be able to delete undefined value", () => {
		const cache = new CacheableMemory();
		cache.delete("key");
		expect(cache.get("key")).toBe(undefined);
	});
	test("should be able to delete many values", () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		cache.deleteMany(["key", "key1", "key2", "key3", "key4"]);
		expect(cache.get("key")).toBe(undefined);
		expect(cache.get("key1")).toBe(undefined);
		expect(cache.get("key2")).toBe(undefined);
		expect(cache.get("key3")).toBe(undefined);
		expect(cache.get("key4")).toBe(undefined);
	});
});

describe("CacheableMemory Clear", async () => {
	test("should be able to clear all values", () => {
		const cache = new CacheableMemory();
		cache.set("key1", "value1");
		cache.set("foo", "value2");
		cache.set("arch", "value2");
		cache.set("linux", "value2");
		cache.set("windows", "value2");
		cache.clear();
		expect(cache.get("key1")).toBe(undefined);
		expect(cache.get("foo")).toBe(undefined);
	});
});

describe("CacheableMemory Get Store and Hash Key", async () => {
	test("should return the same store for the same key", () => {
		const cache = new CacheableMemory();
		expect(cache.getStore("key")).toBe(cache.getStore("key"));
	});
	test("should return different stores for different keys starting with A to Z", () => {
		const cache = new CacheableMemory();
		cache.set("d", "value");
		expect(cache.getStore("d").get("d")).toBeDefined();
		cache.set("ad", "value");
		expect(cache.getStore("ad").get("ad")).toBeDefined();
		cache.set("aa", "value");
		expect(cache.getStore("aa").get("aa")).toBeDefined();
		cache.set("b", "value");
		expect(cache.getStore("b").get("b")).toBeDefined();
		cache.set("abc", "value");
		expect(cache.getStore("abc").get("abc")).toBeDefined();
		cache.set("bb", "value");
		expect(cache.getStore("bb").get("bb")).toBeDefined();
		cache.set("cc", "value");
		expect(cache.getStore("cc").get("cc")).toBeDefined();
		cache.set("h", "value");
		expect(cache.getStore("h").get("h")).toBeDefined();
		cache.set("apple", "value");
		expect(cache.getStore("apple").get("apple")).toBeDefined();
		cache.set("banana", "value");
		expect(cache.getStore("banana").get("banana")).toBeDefined();
		cache.set("carrot", "value");
		expect(cache.getStore("carrot").get("carrot")).toBeDefined();
		cache.set("4123", "value");
		expect(cache.getStore("4123").get("4123")).toBeDefined();
		cache.set("mouse", "value");
		expect(cache.getStore("mouse").get("mouse")).toBeDefined();
		cache.set("ice", "value");
		expect(cache.getStore("ice").get("ice")).toBeDefined();
	});
});

describe("CacheableMemory LRU", async () => {
	test("should remove the least recently used item", () => {
		const cache = new CacheableMemory({ lruSize: 3 });
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");
		expect(cache.size).toBe(3);
		cache.set("key4", "value4");
		expect(cache.size).toBe(3);
	});
	test("should remove the least recently used item with default lruSize", () => {
		const cache = new CacheableMemory({ lruSize: 5 });
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");
		cache.set("key4", "value4");
		cache.set("key5", "value5");
		cache.get("key1");
		cache.get("key2");
		cache.get("key3");
		cache.set("key4", "value4");
		expect(cache.size).toBe(5);
		cache.set("key6", "value6");
		cache.set("key7", "value7");
		expect(cache.size).toBe(5);
		const item = cache.get("key7");
		expect(item).toBe("value7");
	});

	test("should not do anything if setting past 16_777_216 on size", () => {
		const cache = new CacheableMemory({ lruSize: 17_000_000 });
		expect(cache.lruSize).toBe(0);
		cache.lruSize = 5;
		expect(cache.lruSize).toBe(5);
		cache.lruSize = 17_000_000;
		expect(cache.lruSize).toBe(5);
	});

	test("should not do anything if lruSize is 0", () => {
		const cache = new CacheableMemory({ lruSize: 0 });
		cache.set("key1", "value1");
		expect(cache.lruSize).toBe(0);
		cache.lruMoveToFront("key1");
		cache.lruAddToFront("key1");
		expect(cache.size).toBe(1);
	});

	test("should not do the resize on lruSize", () => {
		const cache = new CacheableMemory({ lruSize: 5 });
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");
		cache.lruSize = 0;
		expect(cache.size).toBe(3);
	});

	test("should do the resize on lruSize", () => {
		const cache = new CacheableMemory({ lruSize: 10 });
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");
		cache.set("key4", "value4");
		cache.set("key5", "value5");
		cache.set("key6", "value6");
		cache.set("key7", "value7");
		cache.set("key8", "value8");
		cache.set("key9", "value9");
		cache.set("key10", "value10");
		expect(cache.size).toBe(10);
		cache.lruSize = 5;
		expect(cache.size).toBe(5);
	});
});
describe("CacheableMemory checkInterval", () => {
	test("should be able to set the value", () => {
		const cache = new CacheableMemory({ checkInterval: 1000 });
		expect(cache.checkInterval).toBe(1000);
		cache.checkInterval = 500;
		expect(cache.checkInterval).toBe(500);
		cache.stopIntervalCheck();
		expect(cache.checkInterval).toBe(0);
	});
	test("should be able to check expiration on timed interval", async () => {
		const cache = new CacheableMemory({ checkInterval: 10 }); // 10ms
		cache.set("key1", "value1", 1);
		cache.set("key2", "value2", 1);
		cache.set("key3", "value3", 1000);
		await sleep(20);
		expect(cache.get("key1")).toBe(undefined);
		expect(cache.get("key2")).toBe(undefined);
		expect(cache.get("key3")).toBe("value3");
		cache.stopIntervalCheck();
	});
});

describe("Cacheable Memory ttl parsing", () => {
	test("send in a number on ttl", () => {
		const cache = new CacheableMemory({ ttl: 1000 });
		expect(cache.ttl).toBe(1000);
	});
	test("send in 30s string on ttl", async () => {
		const cache = new CacheableMemory({ ttl: "30ms" });
		expect(cache.ttl).toBe("30ms");
		cache.set("key", "value");
		await sleep(40);
		expect(cache.get("key")).toBe(undefined);
	});
	test("send in 1m string on ttl", async () => {
		const cache = new CacheableMemory();
		expect(cache.ttl).toBe(undefined);
		cache.set("key", "value", "1m");
		expect(cache.getRaw("key")?.expires).toBeGreaterThan(Date.now());
	});
	test("send in 1h string on ttl", async () => {
		const cache = new CacheableMemory();
		expect(cache.ttl).toBe(undefined);
		const datePlus45 = Date.now() + 45 * 60 * 1000;
		cache.set("key", "value", "1h");
		expect(cache.getRaw("key")?.expires).toBeGreaterThan(datePlus45);
	});

	test("have number on default ttl and parse string on set", async () => {
		const cache = new CacheableMemory({ ttl: 1000 });
		expect(cache.ttl).toBe(1000);
		const datePlus45 = Date.now() + 45 * 60 * 1000;
		cache.set("key", "value", "1h");
		expect(cache.getRaw("key")?.expires).toBeGreaterThan(datePlus45);
	});
});

describe("cacheable wrap", async () => {
	test("should wrap method with key and ttl", async () => {
		const cacheable = new CacheableMemory();
		const syncFunction = (value: number) => Math.random() * value;
		const options = {
			keyPrefix: "prefix",
			ttl: 10,
		};

		const wrapped = cacheable.wrap(syncFunction, options);
		const result = wrapped(1);
		const result2 = wrapped(1);
		expect(result).toBe(result2);
		const cacheKey = createWrapKey(syncFunction, [1], {
			keyPrefix: options.keyPrefix,
		});
		const cacheResult1 = cacheable.get<number>(cacheKey);
		expect(cacheResult1).toBe(result);
		await sleep(20);
		const cacheResult2 = cacheable.get<number>(cacheKey);
		expect(cacheResult2).toBeUndefined();
	});

	test("should wrap to default ttl", async () => {
		const cacheable = new CacheableMemory({ ttl: 5 });
		const asyncFunction = (value: number) => Math.random() * value;
		const options = {
			keyPrefix: "wrapPrefix",
		};
		const wrapped = cacheable.wrap(asyncFunction, options);
		const result = wrapped(1);
		const result2 = wrapped(1);
		expect(result).toBe(result2); // Cached
		await sleep(10);
		const result3 = wrapped(1);
		expect(result3).not.toBe(result2);
	});

	test("should wrap and not expire because no ttl set at all", async () => {
		const cacheable = new CacheableMemory();
		const asyncFunction = (value: number) => Math.random() * value;
		const wrapped = cacheable.wrap(asyncFunction);
		const result = wrapped(1);
		const result2 = wrapped(1);
		expect(result).toBe(result2); // Cached
	});

	test("CacheableMemory.wrap() passes createKey option through", () => {
		const cacheable = new CacheableMemory();
		let createKeyCalled = false;
		const testFunction = (argument: string) => `Result for ${argument}`;
		const options = {
			createKey: () => {
				createKeyCalled = true;
				return "testKey";
			},
		};

		const wrapped = cacheable.wrap(testFunction, options);
		wrapped("arg1");
		expect(createKeyCalled).toBe(true);
	});

	test("should be able to pass in expiration time", async () => {
		const cacheable = new CacheableMemory();
		const expire = Date.now() + 100;
		cacheable.set("key-expire1", "value1", { expire });
		const result = cacheable.get("key-expire1");
		expect(result).toBe("value1");
		await sleep(150);
		const result2 = cacheable.get("key-expire1");
		expect(result2).toBeUndefined();
	});

	test("should be able to pass in ttl as object", async () => {
		const cacheable = new CacheableMemory();
		const ttl = "100ms";
		cacheable.set("key-expire12", "value1", { ttl });
		const result = cacheable.get("key-expire12");
		expect(result).toBe("value1");
		await sleep(150);
		const result2 = cacheable.get("key-expire12");
		expect(result2).toBeUndefined();
	});

	test("should be able to pass in expiration time with date", async () => {
		const cacheable = new CacheableMemory();
		const expire = new Date(Date.now() + 100);
		cacheable.set("key-expire2", "value2", { expire });
		const result = cacheable.get("key-expire2");
		expect(result).toBe("value2");
		await sleep(150);
		const result2 = cacheable.get("key-expire2");
		expect(result2).toBeUndefined();
	});
});

describe("cacheable getOrSet", async () => {
	test("should compute on miss and return the cached value on hit", () => {
		const cacheable = new CacheableMemory();
		let calls = 0;
		const function_ = () => {
			calls++;
			return Math.random() * 100;
		};
		const result1 = cacheable.getOrSet("gos-key", function_);
		const result2 = cacheable.getOrSet("gos-key", function_);
		expect(result1).toBe(result2);
		expect(calls).toBe(1);
		expect(cacheable.get("gos-key")).toBe(result1);
	});

	test("should use the instance default ttl and recompute after expiry", async () => {
		const cacheable = new CacheableMemory({ ttl: 50 });
		let calls = 0;
		const function_ = () => {
			calls++;
			return calls;
		};
		expect(cacheable.getOrSet("gos-ttl-default", function_)).toBe(1);
		expect(cacheable.getOrSet("gos-ttl-default", function_)).toBe(1); // cached
		await sleep(60);
		expect(cacheable.getOrSet("gos-ttl-default", function_)).toBe(2); // recomputed
	});

	test("should override the ttl per call", async () => {
		const cacheable = new CacheableMemory();
		let calls = 0;
		const function_ = () => {
			calls++;
			return calls;
		};
		cacheable.getOrSet("gos-ttl-override", function_, { ttl: "50ms" });
		await sleep(60);
		expect(
			cacheable.getOrSet("gos-ttl-override", function_, { ttl: "50ms" }),
		).toBe(2);
	});

	test("should support a key function", () => {
		const cacheable = new CacheableMemory();
		let calls = 0;
		const function_ = () => {
			calls++;
			return calls;
		};
		const key = () => "gos-computed-key";
		const result1 = cacheable.getOrSet(key, function_);
		const result2 = cacheable.getOrSet(key, function_);
		expect(result1).toBe(result2);
		expect(calls).toBe(1);
	});

	test("should emit an error and return undefined when the function throws", () => {
		const cacheable = new CacheableMemory();
		let errorCount = 0;
		cacheable.on("error", (error: Error) => {
			expect(error.message).toBe("boom");
			errorCount++;
		});
		const result = cacheable.getOrSet("gos-err", () => {
			throw new Error("boom");
		});
		expect(result).toBeUndefined();
		expect(errorCount).toBe(1);
		expect(cacheable.get("gos-err")).toBeUndefined(); // not cached by default
	});

	test("should cache the error when cacheErrors is enabled", () => {
		const cacheable = new CacheableMemory();
		let calls = 0;
		const function_ = () => {
			calls++;
			throw new Error("boom");
		};
		cacheable.getOrSet("gos-err-cache", function_, { cacheErrors: true });
		const cached = cacheable.get("gos-err-cache");
		expect(cached).toBeInstanceOf(Error);
		expect(calls).toBe(1);
	});

	test("should rethrow when throwErrors is true", () => {
		const cacheable = new CacheableMemory();
		expect(() =>
			cacheable.getOrSet(
				"gos-err-throw",
				() => {
					throw new Error("boom");
				},
				{ throwErrors: true },
			),
		).toThrow("boom");
	});
});

describe("CacheableMemory LRU and TTL integration", () => {
	test("should remove from LRU when item expires via get()", async () => {
		const cache = new CacheableMemory({ lruSize: 5 });
		cache.set("key1", "value1", 10); // 10ms TTL
		cache.set("key2", "value2");
		cache.set("key3", "value3");

		expect(cache.size).toBe(3);

		await sleep(20);

		// Access expired item - should trigger removal from both store and LRU
		expect(cache.get("key1")).toBeUndefined();

		// Add more items to fill up LRU
		cache.set("key4", "value4");
		cache.set("key5", "value5");
		cache.set("key6", "value6");

		// key2 and key3 should still exist (not evicted by LRU due to orphaned nodes)
		expect(cache.get("key2")).toBe("value2");
		expect(cache.get("key3")).toBe("value3");
	});

	test("should remove from LRU when item expires via checkExpiration()", async () => {
		const cache = new CacheableMemory({ lruSize: 5, checkInterval: 10 });
		cache.set("key1", "value1", 5); // 5ms TTL
		cache.set("key2", "value2");

		await sleep(20);

		// checkExpiration should have run and cleaned up LRU
		// Now add items to approach the limit
		cache.set("key3", "value3");
		cache.set("key4", "value4");
		cache.set("key5", "value5");
		cache.set("key6", "value6");

		// All non-expired items should still be accessible
		expect(cache.get("key2")).toBe("value2");
		expect(cache.get("key3")).toBe("value3");

		cache.stopIntervalCheck();
	});

	test("should remove from LRU on explicit delete()", () => {
		const cache = new CacheableMemory({ lruSize: 5 });
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");

		cache.delete("key2");

		// Add more items
		cache.set("key4", "value4");
		cache.set("key5", "value5");
		cache.set("key6", "value6");

		// Should not have evicted key1 or key3 since key2 was properly removed from LRU
		expect(cache.get("key1")).toBe("value1");
		expect(cache.get("key3")).toBe("value3");
	});

	test("should maintain LRU size consistency after TTL expiration", async () => {
		const cache = new CacheableMemory({ lruSize: 3 });

		// Set 3 items with short TTL
		cache.set("a", "1", 10);
		cache.set("b", "2", 10);
		cache.set("c", "3", 10);

		await sleep(20);

		// Access all items to trigger expiration cleanup
		cache.get("a");
		cache.get("b");
		cache.get("c");

		// Now set 3 new items - they should all fit since old ones were removed from LRU
		cache.set("d", "4");
		cache.set("e", "5");
		cache.set("f", "6");

		expect(cache.size).toBe(3);
		expect(cache.get("d")).toBe("4");
		expect(cache.get("e")).toBe("5");
		expect(cache.get("f")).toBe("6");
	});

	test("should handle deleteMany with LRU cleanup", () => {
		const cache = new CacheableMemory({ lruSize: 10 });
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.set("key3", "value3");
		cache.set("key4", "value4");

		cache.deleteMany(["key1", "key3"]);

		// Fill up the cache
		for (let i = 5; i <= 12; i++) {
			cache.set(`key${i}`, `value${i}`);
		}

		// key2 and key4 should still exist (not evicted by LRU)
		expect(cache.get("key2")).toBe("value2");
		expect(cache.get("key4")).toBe("value4");
	});

	test("should remove from LRU when expired item accessed via keys getter", async () => {
		const cache = new CacheableMemory({ lruSize: 5 });
		cache.set("exp1", "value1", 10);
		cache.set("exp2", "value2", 10);
		cache.set("keep", "value3");

		await sleep(20);

		// Access keys getter - should clean up expired items from LRU
		const keys = [...cache.keys];
		expect(keys).not.toContain("exp1");
		expect(keys).not.toContain("exp2");
		expect(keys).toContain("keep");

		// Add more items
		cache.set("new1", "v1");
		cache.set("new2", "v2");
		cache.set("new3", "v3");
		cache.set("new4", "v4");

		// Should still have 'keep' since LRU was properly cleaned
		expect(cache.get("keep")).toBe("value3");
	});

	test("should remove from LRU when expired item accessed via items getter", async () => {
		const cache = new CacheableMemory({ lruSize: 5 });
		cache.set("exp", "value1", 10);
		cache.set("keep1", "value2");
		cache.set("keep2", "value3");

		await sleep(20);

		// Access items getter - should clean up expired items from LRU
		const items = [...cache.items];
		expect(items.find((i) => i.key === "exp")).toBeUndefined();

		cache.set("new1", "v1");
		cache.set("new2", "v2");
		cache.set("new3", "v3");

		// keep1 and keep2 should still exist
		expect(cache.get("keep1")).toBe("value2");
		expect(cache.get("keep2")).toBe("value3");
	});

	test("should remove from LRU when expired item accessed via getRaw()", async () => {
		const cache = new CacheableMemory({ lruSize: 3 });
		cache.set("exp", "value1", 10);
		cache.set("keep", "value2");

		await sleep(20);

		// Access via getRaw - should trigger removal from both store and LRU
		expect(cache.getRaw("exp")).toBeUndefined();

		// Add more items
		cache.set("new1", "v1");
		cache.set("new2", "v2");

		// 'keep' should still exist
		expect(cache.get("keep")).toBe("value2");
	});
});

describe("CacheableMemory Hooks", () => {
	test("should handle BEFORE_SET and AFTER_SET hooks", () => {
		const cache = new CacheableMemory();
		let beforeSet = false;
		let afterSet = false;
		cache.onHook(CacheableMemoryHooks.BEFORE_SET, (item) => {
			beforeSet = true;
			item.value = "new value";
		});
		cache.onHook(CacheableMemoryHooks.AFTER_SET, (item) => {
			afterSet = true;
			expect(item.value).toEqual("new value");
		});
		cache.set("key", "value");
		expect(beforeSet).toBe(true);
		expect(afterSet).toBe(true);
		expect(cache.get("key")).toEqual("new value");
	});

	test("should allow BEFORE_SET hook to modify ttl", () => {
		const cache = new CacheableMemory();
		cache.onHook(CacheableMemoryHooks.BEFORE_SET, (item) => {
			item.ttl = "1h";
		});
		cache.set("key", "value");
		const raw = cache.getRaw("key");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeGreaterThan(Date.now());
	});

	test("should handle BEFORE_SET_MANY and AFTER_SET_MANY hooks", () => {
		const cache = new CacheableMemory();
		let beforeSetMany = false;
		let afterSetMany = false;
		cache.onHook(CacheableMemoryHooks.BEFORE_SET_MANY, (items) => {
			beforeSetMany = true;
			expect(items).toHaveLength(2);
		});
		cache.onHook(CacheableMemoryHooks.AFTER_SET_MANY, (items) => {
			afterSetMany = true;
			expect(items).toHaveLength(2);
		});
		cache.setMany([
			{ key: "key1", value: "value1" },
			{ key: "key2", value: "value2" },
		]);
		expect(beforeSetMany).toBe(true);
		expect(afterSetMany).toBe(true);
	});

	test("should handle BEFORE_GET and AFTER_GET hooks", () => {
		const cache = new CacheableMemory();
		let beforeGet = false;
		let afterGet = false;
		cache.onHook(CacheableMemoryHooks.BEFORE_GET, (key) => {
			beforeGet = true;
			expect(key).toEqual("key");
		});
		cache.onHook(CacheableMemoryHooks.AFTER_GET, (item) => {
			afterGet = true;
			expect(item.key).toEqual("key");
			expect(item.result).toEqual("value");
		});
		cache.set("key", "value");
		cache.get("key");
		expect(beforeGet).toBe(true);
		expect(afterGet).toBe(true);
	});

	test("should handle AFTER_GET hook with undefined result on cache miss", () => {
		const cache = new CacheableMemory();
		let afterGet = false;
		cache.onHook(CacheableMemoryHooks.AFTER_GET, (item) => {
			afterGet = true;
			expect(item.key).toEqual("missing");
			expect(item.result).toBeUndefined();
		});
		cache.get("missing");
		expect(afterGet).toBe(true);
	});

	test("should handle BEFORE_GET_MANY and AFTER_GET_MANY hooks", () => {
		const cache = new CacheableMemory();
		let beforeGetMany = false;
		let afterGetMany = false;
		cache.onHook(CacheableMemoryHooks.BEFORE_GET_MANY, (keys) => {
			beforeGetMany = true;
			expect(keys).toEqual(["key1", "key2"]);
		});
		cache.onHook(CacheableMemoryHooks.AFTER_GET_MANY, (data) => {
			afterGetMany = true;
			expect(data.keys).toEqual(["key1", "key2"]);
			expect(data.result).toEqual(["value1", "value2"]);
		});
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.getMany(["key1", "key2"]);
		expect(beforeGetMany).toBe(true);
		expect(afterGetMany).toBe(true);
	});

	test("should handle BEFORE_DELETE and AFTER_DELETE hooks", () => {
		const cache = new CacheableMemory();
		let beforeDelete = false;
		let afterDelete = false;
		cache.onHook(CacheableMemoryHooks.BEFORE_DELETE, (key) => {
			beforeDelete = true;
			expect(key).toEqual("key");
		});
		cache.onHook(CacheableMemoryHooks.AFTER_DELETE, (key) => {
			afterDelete = true;
			expect(key).toEqual("key");
		});
		cache.set("key", "value");
		cache.delete("key");
		expect(beforeDelete).toBe(true);
		expect(afterDelete).toBe(true);
		expect(cache.get("key")).toBeUndefined();
	});

	test("should handle BEFORE_DELETE_MANY and AFTER_DELETE_MANY hooks", () => {
		const cache = new CacheableMemory();
		let beforeDeleteMany = false;
		let afterDeleteMany = false;
		cache.onHook(CacheableMemoryHooks.BEFORE_DELETE_MANY, (keys) => {
			beforeDeleteMany = true;
			expect(keys).toEqual(["key1", "key2"]);
		});
		cache.onHook(CacheableMemoryHooks.AFTER_DELETE_MANY, (keys) => {
			afterDeleteMany = true;
			expect(keys).toEqual(["key1", "key2"]);
		});
		cache.set("key1", "value1");
		cache.set("key2", "value2");
		cache.deleteMany(["key1", "key2"]);
		expect(beforeDeleteMany).toBe(true);
		expect(afterDeleteMany).toBe(true);
	});

	test("should handle BEFORE_CLEAR and AFTER_CLEAR hooks", () => {
		const cache = new CacheableMemory();
		let beforeClear = false;
		let afterClear = false;
		cache.onHook(CacheableMemoryHooks.BEFORE_CLEAR, () => {
			beforeClear = true;
		});
		cache.onHook(CacheableMemoryHooks.AFTER_CLEAR, () => {
			afterClear = true;
		});
		cache.set("key", "value");
		cache.clear();
		expect(beforeClear).toBe(true);
		expect(afterClear).toBe(true);
		expect(cache.size).toBe(0);
	});

	test("should handle BEFORE_SET hook modifying the key", () => {
		const cache = new CacheableMemory();
		cache.onHook(CacheableMemoryHooks.BEFORE_SET, (item) => {
			item.key = `prefix:${item.key}`;
		});
		cache.set("key", "value");
		expect(cache.get("key")).toBeUndefined();
		expect(cache.get("prefix:key")).toEqual("value");
	});

	test("should handle AFTER_GET with expired item", async () => {
		const cache = new CacheableMemory();
		let afterGetResult: unknown;
		cache.onHook(CacheableMemoryHooks.AFTER_GET, (item) => {
			afterGetResult = item.result;
		});
		cache.set("key", "value", 5);
		await sleep(20);
		cache.get("key");
		expect(afterGetResult).toBeUndefined();
	});
});

describe("CacheableMemory maxTtl", () => {
	test("should have default maxTtl as undefined", () => {
		const cache = new CacheableMemory();
		expect(cache.maxTtl).toBe(undefined);
	});

	test("should set maxTtl via constructor", () => {
		const cache = new CacheableMemory({ maxTtl: 5000 });
		expect(cache.maxTtl).toBe(5000);
	});

	test("should set maxTtl via constructor with string", () => {
		const cache = new CacheableMemory({ maxTtl: "1h" });
		expect(cache.maxTtl).toBe("1h");
	});

	test("should set maxTtl via setter", () => {
		const cache = new CacheableMemory();
		cache.maxTtl = 10_000;
		expect(cache.maxTtl).toBe(10_000);
	});

	test("should set maxTtl via setter with string", () => {
		const cache = new CacheableMemory();
		cache.maxTtl = "30m";
		expect(cache.maxTtl).toBe("30m");
	});

	test("should disable maxTtl by setting to undefined", () => {
		const cache = new CacheableMemory({ maxTtl: 5000 });
		expect(cache.maxTtl).toBe(5000);
		cache.maxTtl = undefined;
		expect(cache.maxTtl).toBe(undefined);
	});

	test("should disable maxTtl by setting to 0 or negative", () => {
		const cache = new CacheableMemory({ maxTtl: 5000 });
		cache.maxTtl = 0;
		expect(cache.maxTtl).toBe(undefined);
		cache.maxTtl = 5000;
		cache.maxTtl = -1;
		expect(cache.maxTtl).toBe(undefined);
	});

	test("should handle negative maxTtl in constructor", () => {
		const cache = new CacheableMemory({ maxTtl: -1 });
		expect(cache.maxTtl).toBe(undefined);
	});

	test("should cap ttl when it exceeds maxTtl", async () => {
		const cache = new CacheableMemory({ maxTtl: 50 });
		cache.set("key1", "value1", 200);
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeLessThanOrEqual(now + 55);
		expect(raw?.expires as number).toBeGreaterThan(now);
	});

	test("should not cap ttl when it is within maxTtl", async () => {
		const cache = new CacheableMemory({ maxTtl: 5000 });
		cache.set("key1", "value1", 100);
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeLessThanOrEqual(now + 105);
		expect(raw?.expires as number).toBeGreaterThan(now);
	});

	test("should enforce maxTtl when no ttl is set on entry or default", async () => {
		const cache = new CacheableMemory({ maxTtl: 100 });
		cache.set("key1", "value1");
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeLessThanOrEqual(now + 105);
		expect(raw?.expires as number).toBeGreaterThan(now);
	});

	test("should enforce maxTtl when default ttl exceeds maxTtl", async () => {
		const cache = new CacheableMemory({ ttl: 5000, maxTtl: 100 });
		cache.set("key1", "value1");
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeLessThanOrEqual(now + 105);
		expect(raw?.expires as number).toBeGreaterThan(now);
	});

	test("should work with maxTtl as shorthand string", async () => {
		const cache = new CacheableMemory({ maxTtl: "1s" });
		cache.set("key1", "value1", "1h");
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeLessThanOrEqual(now + 1005);
		expect(raw?.expires as number).toBeGreaterThan(now);
	});

	test("should expire items at maxTtl boundary", async () => {
		const cache = new CacheableMemory({ maxTtl: 30 });
		cache.set("key1", "value1", 5000);
		expect(cache.get("key1")).toBe("value1");
		await sleep(40);
		expect(cache.get("key1")).toBeUndefined();
	});

	test("should enforce maxTtl on setMany", async () => {
		const cache = new CacheableMemory({ maxTtl: 100 });
		cache.setMany([
			{ key: "k1", value: "v1", ttl: 5000 },
			{ key: "k2", value: "v2" },
		]);
		const raw1 = cache.getRaw("k1");
		const raw2 = cache.getRaw("k2");
		const now = Date.now();
		expect(raw1).toBeDefined();
		expect(raw1?.expires).toBeDefined();
		expect(raw1?.expires as number).toBeLessThanOrEqual(now + 105);
		expect(raw2).toBeDefined();
		expect(raw2?.expires).toBeDefined();
		expect(raw2?.expires as number).toBeLessThanOrEqual(now + 105);
	});

	test("should enforce maxTtl when SetOptions object with ttl is used", () => {
		const cache = new CacheableMemory({ maxTtl: 100 });
		cache.set("key1", "value1", { ttl: 5000 });
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeLessThanOrEqual(now + 105);
	});

	test("should enforce maxTtl when SetOptions object with expire is used", () => {
		const cache = new CacheableMemory({ maxTtl: 100 });
		const farFutureExpire = Date.now() + 60_000;
		cache.set("key1", "value1", { expire: farFutureExpire });
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeLessThanOrEqual(now + 105);
	});

	test("should not interfere when maxTtl is undefined", () => {
		const cache = new CacheableMemory({ ttl: 5000 });
		cache.set("key1", "value1");
		const raw = cache.getRaw("key1");
		expect(raw).toBeDefined();
		expect(raw?.expires).toBeDefined();
		const now = Date.now();
		expect(raw?.expires as number).toBeGreaterThan(now + 4000);
	});
});

describe("CacheableMemory Statistics", () => {
	test("should have stats disabled by default and never count", () => {
		const cache = new CacheableMemory();
		expect(cache.stats.enabled).toBe(false);
		cache.set("key", "value");
		cache.get("key");
		cache.get("missing");
		cache.delete("key");
		cache.clear();
		expect(cache.stats.hits).toBe(0);
		expect(cache.stats.misses).toBe(0);
		expect(cache.stats.gets).toBe(0);
		expect(cache.stats.sets).toBe(0);
		expect(cache.stats.deletes).toBe(0);
		expect(cache.stats.clears).toBe(0);
		expect(cache.stats.count).toBe(0);
		expect(cache.stats.ksize).toBe(0);
		expect(cache.stats.vsize).toBe(0);
	});

	test("should enable stats via the constructor option", () => {
		const cache = new CacheableMemory({ stats: true });
		expect(cache.stats.enabled).toBe(true);
	});

	test("should enable and disable stats via the setter", () => {
		const cache = new CacheableMemory();
		expect(cache.stats.enabled).toBe(false);
		cache.stats.enabled = true;
		cache.set("key", "value");
		expect(cache.stats.sets).toBe(1);
		cache.stats.enabled = false;
		cache.set("key2", "value2");
		expect(cache.stats.sets).toBe(1);
	});

	test("should track sets, count, ksize, and vsize on set", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value");
		expect(cache.stats.sets).toBe(1);
		expect(cache.stats.count).toBe(1);
		expect(cache.stats.ksize).toBeGreaterThan(0);
		expect(cache.stats.vsize).toBeGreaterThan(0);
	});

	test("should not inflate count or ksize when overwriting a key", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "short");
		const ksizeAfterFirst = cache.stats.ksize;
		cache.set("key", "a-much-longer-value-than-before");
		expect(cache.stats.count).toBe(1);
		expect(cache.stats.ksize).toBe(ksizeAfterFirst);
		expect(cache.stats.sets).toBe(2);
		expect(cache.stats.vsize).toBeGreaterThan(0);
	});

	test("should track each item in setMany as a set", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.setMany([
			{ key: "a", value: 1 },
			{ key: "b", value: 2 },
		]);
		expect(cache.stats.sets).toBe(2);
		expect(cache.stats.count).toBe(2);
		expect(cache.stats.ksize).toBeGreaterThan(0);
		expect(cache.stats.vsize).toBeGreaterThan(0);
	});

	test("should track gets, hits, and misses on get", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value");
		expect(cache.get("key")).toBe("value");
		expect(cache.get("missing")).toBeUndefined();
		expect(cache.stats.gets).toBe(2);
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.misses).toBe(1);
	});

	test("should record a miss when a get finds an expired entry", async () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value", 1);
		await sleep(5);
		expect(cache.get("key")).toBeUndefined();
		expect(cache.stats.misses).toBe(1);
		expect(cache.stats.hits).toBe(0);
		expect(cache.stats.gets).toBe(1);
	});

	test("should track each key in getMany as a separate get", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("a", 1);
		const result = cache.getMany(["a", "b"]);
		expect(result).toEqual([1, undefined]);
		expect(cache.stats.gets).toBe(2);
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.misses).toBe(1);
	});

	test("should track hits and misses on getRaw", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("a", 1);
		expect(cache.getRaw("a")).toBeDefined();
		expect(cache.getRaw("b")).toBeUndefined();
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.misses).toBe(1);
		expect(cache.stats.gets).toBe(2);
	});

	test("should record a miss when getRaw finds an expired entry", async () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value", 1);
		await sleep(5);
		expect(cache.getRaw("key")).toBeUndefined();
		expect(cache.stats.misses).toBe(1);
		expect(cache.stats.gets).toBe(1);
	});

	test("should track each key in getManyRaw as a separate get", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("a", 1);
		cache.getManyRaw(["a", "b"]);
		expect(cache.stats.gets).toBe(2);
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.misses).toBe(1);
	});

	test("should count has() as a read", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value");
		expect(cache.has("key")).toBe(true);
		expect(cache.has("missing")).toBe(false);
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.misses).toBe(1);
		expect(cache.stats.gets).toBe(2);
	});

	test("should track deletes and decrement count, ksize, and vsize on delete", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value");
		cache.delete("key");
		expect(cache.stats.deletes).toBe(1);
		expect(cache.stats.count).toBe(0);
		expect(cache.stats.ksize).toBe(0);
		expect(cache.stats.vsize).toBe(0);
	});

	test("should not change stats when deleting a missing key", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.delete("missing");
		expect(cache.stats.deletes).toBe(0);
		expect(cache.stats.count).toBe(0);
	});

	test("should track deletes for deleteMany", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.setMany([
			{ key: "a", value: 1 },
			{ key: "b", value: 2 },
		]);
		cache.deleteMany(["a", "b"]);
		expect(cache.stats.deletes).toBe(2);
		expect(cache.stats.count).toBe(0);
	});

	test("should record a get and a delete for take()", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value");
		expect(cache.take("key")).toBe("value");
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.gets).toBe(1);
		expect(cache.stats.deletes).toBe(1);
		expect(cache.stats.count).toBe(0);
	});

	test("should count an LRU eviction as a delete", () => {
		const cache = new CacheableMemory({ stats: true, lruSize: 1 });
		cache.set("a", "1");
		cache.set("b", "2"); // evicts "a"
		expect(cache.stats.sets).toBe(2);
		expect(cache.stats.deletes).toBe(1);
		expect(cache.stats.count).toBe(1);
	});

	test("should reset store values and increment clears on clear", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.setMany([
			{ key: "a", value: 1 },
			{ key: "b", value: 2 },
		]);
		expect(cache.stats.count).toBe(2);
		expect(cache.stats.ksize).toBeGreaterThan(0);
		expect(cache.stats.vsize).toBeGreaterThan(0);
		cache.clear();
		expect(cache.stats.count).toBe(0);
		expect(cache.stats.ksize).toBe(0);
		expect(cache.stats.vsize).toBe(0);
		expect(cache.stats.clears).toBe(1);
	});

	test("should expose hitRate and a snapshot via toJSON", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value");
		cache.get("key");
		cache.get("missing");
		expect(cache.stats.hitRate).toBeCloseTo(0.5);
		const snapshot = cache.stats.toJSON();
		expect(snapshot.enabled).toBe(true);
		expect(snapshot.hits).toBe(1);
		expect(snapshot.misses).toBe(1);
		expect(snapshot.count).toBe(1);
	});

	test("should reset counters via stats.reset()", () => {
		const cache = new CacheableMemory({ stats: true });
		cache.set("key", "value");
		cache.get("key");
		cache.stats.reset();
		expect(cache.stats.hits).toBe(0);
		expect(cache.stats.gets).toBe(0);
		expect(cache.stats.sets).toBe(0);
		expect(cache.stats.count).toBe(0);
	});

	test("should track stats for wrapped functions", () => {
		const cache = new CacheableMemory({ stats: true });
		let calls = 0;
		const wrapped = cache.wrap(
			(value: number) => {
				calls++;
				return value * 2;
			},
			{ keyPrefix: "double" },
		);
		expect(wrapped(2)).toBe(4);
		expect(wrapped(2)).toBe(4);
		expect(calls).toBe(1);
		expect(cache.stats.misses).toBe(1);
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.sets).toBe(1);
		expect(cache.stats.gets).toBe(2);
	});

	test("should track stats for getOrSet", () => {
		const cache = new CacheableMemory({ stats: true });
		let calls = 0;
		const compute = () => {
			calls++;
			return 42;
		};
		expect(cache.getOrSet("answer", compute)).toBe(42);
		expect(cache.getOrSet("answer", compute)).toBe(42);
		expect(calls).toBe(1);
		expect(cache.stats.misses).toBe(1);
		expect(cache.stats.hits).toBe(1);
		expect(cache.stats.sets).toBe(1);
	});
});
