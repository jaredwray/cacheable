// biome-ignore-all lint/style/noNonNullAssertion: test file
import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";
import NodeCache from "../src/index.js";

const sleep = async (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

const cache = new NodeCache<string>({ checkperiod: 0 });

describe("NodeCache", () => {
	test("should create a new instance of NodeCache", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		expect(cache).toBeInstanceOf(NodeCache);
	});

	test("should create a new instance of NodeCache with options", () => {
		const cache = new NodeCache({ stdTTL: 10, checkperiod: 0 });
		expect(cache).toBeInstanceOf(NodeCache);
		expect(cache.options.stdTTL).toBe(10);
	});

	test("should set and get a key", () => {
		const localCache = new NodeCache<string>({ checkperiod: 0 });
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		localCache.on("set", (k, v) => {
			expect(k).toBe(key);
			expect(v).toBe(value);
		});
		localCache.set(key, value);
		expect(localCache.get(key)).toBe(value);
	});

	test("should set and get a key with ttl", async () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const value1 = faker.lorem.word();
		const key2 = faker.string.uuid();
		const value2 = faker.lorem.word();
		cache.set(key1, value1, 0.5);
		cache.set(key2, value2);
		await sleep(600);
		expect(cache.get(key1)).toBe(undefined);
		expect(cache.get(key2)).toBe(value2);
	});

	test("should set multiple cache items", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const value1 = faker.lorem.word();
		const key2 = faker.string.uuid();
		const value2 = faker.lorem.word();
		const list = [
			{ key: key1, value: value1 },
			{ key: key2, value: value2 },
		];
		cache.mset(list);
		expect(cache.get(key1)).toBe(value1);
		expect(cache.get(key2)).toBe(value2);
	});

	test("should store items with negative ttl in mset but they expire immediately on access", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const goodKey = faker.string.uuid();
		const goodValue = faker.lorem.word();
		const badKey = faker.string.uuid();
		const badValue = faker.lorem.word();
		const list = [
			{ key: goodKey, value: goodValue },
			{ key: badKey, value: badValue, ttl: -1 },
		];
		const result = cache.mset(list);
		expect(result).toBe(true);
		expect(cache.get(goodKey)).toBe(goodValue);
		// Negative TTL item is stored but has() already sees it as expired
		expect(cache.has(badKey)).toBe(false);
		expect(cache.get(badKey)).toBe(undefined);
		expect(cache.has(badKey)).toBe(false);
	});

	test("should get multiple cache items", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const value1 = faker.lorem.word();
		const key2 = faker.string.uuid();
		const value2 = faker.lorem.word();
		cache.set(key1, value1);
		cache.set(key2, value2);
		const list = cache.mget([key1, key2]);
		expect(list[key1]).toBe(value1);
		expect(list[key2]).toBe(value2);
	});

	test("should not pollute Object.prototype via mget with __proto__ key", () => {
		cache.set("__proto__", { polluted: true });
		const result = cache.mget(["__proto__"]);
		// biome-ignore lint/suspicious/noExplicitAny: testing prototype pollution
		expect((Object.prototype as any).polluted).toBeUndefined();
		expect(Object.getPrototypeOf(result)).toBeNull();
		expect(Object.hasOwn(result, "__proto__")).toBe(true);
	});

	test("should take a key", () => {
		const key = faker.string.uuid();
		const val = faker.lorem.word();
		cache.set(key, val);
		const value = cache.take(key)!;
		expect(value).toBe(val);
		expect(cache.get(key)).toBe(undefined);
	});

	test("should take a key with useClones set to false", () => {
		const cache = new NodeCache({ checkperiod: 0, useClones: false });
		const key = faker.string.uuid();
		const val = faker.lorem.word();
		cache.set(key, val);
		const value = cache.take(key)!;
		expect(value).toBe(val);
		expect(cache.get(key)).toBe(undefined);
	});

	test("should take a key and be undefined", () => {
		expect(cache.take(faker.string.uuid())).toBe(undefined);
	});

	test("should take falsy values and clear stats", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, 0);

		const taken = cache.take(key);
		expect(taken).toBe(0);
		expect(cache.has(key)).toBe(false);

		const stats = cache.getStats();
		expect(stats.keys).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.vsize).toBe(0);
	});

	test("should delete a key", () => {
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word());
		cache.del(key);
		expect(cache.get(key)).toBe(undefined);
	});

	test("should use del() to delete multiple keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const value1 = faker.lorem.word();
		const key2 = faker.string.uuid();
		const key3 = faker.string.uuid();
		const list = [
			{ key: key1, value: value1 },
			{ key: key2, value: faker.lorem.word() },
		];
		cache.mset(list);
		cache.set(key3, faker.lorem.word());
		const resultCount = cache.del([key3, key2]);
		expect(resultCount).toBe(2);
		expect(cache.get(key1)).toBe(value1);
	});

	test("should delete multiple keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		cache.set(key1, faker.lorem.word());
		cache.set(key2, faker.lorem.word());
		cache.mdel([key1, key2]);
		expect(cache.get(key1)).toBe(undefined);
		expect(cache.get(key2)).toBe(undefined);
	});

	test("should get the ttl / expiration of a key", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word(), 10);
		const firstTtl = cache.getTtl(key)!;
		expect(firstTtl).toBeDefined();
		cache.ttl(key, 15);
		const secondTtl = cache.getTtl(key);
		expect(firstTtl).toBeLessThan(secondTtl!);
	});

	test("should get undefined when on getTtl()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const ttl = cache.getTtl(faker.string.uuid());
		expect(ttl).toBe(undefined);
	});

	test("ttl should default to 0 if no ttl is set", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word());
		const ttl = cache.getTtl(key);
		expect(ttl).toBe(0);
		cache.ttl(key); // No args, stdTTL is 0 → stays unlimited
		const ttl2 = cache.getTtl(key);
		expect(ttl2).toBe(0);
	});

	test("should return 0 if there is no key to delete", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const count = cache.del(faker.string.uuid());
		expect(count).toBe(0);
	});

	test("should return the correct count on mdel()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		const missingKey = faker.string.uuid();
		const list = [
			{ key: key1, value: faker.lorem.word() },
			{ key: key2, value: faker.lorem.word() },
		];
		cache.mset(list);
		const count = cache.mdel([key1, key2, missingKey]);
		expect(count).toBe(2);
	});

	test("it should return a 0 if there is no ttl set", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word());
		const ttl = cache.getTtl(key);
		expect(ttl).toBe(0);
	});

	test("should return false if there is no key on ttl()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const ttl = cache.ttl(faker.string.uuid(), 10);
		expect(ttl).toBe(false);
	});

	test("should return an array of keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		cache.set(key1, faker.lorem.word());
		cache.set(key2, faker.lorem.word());
		const keys = cache.keys();
		expect(keys).toEqual([key1, key2]);
	});

	test("should return true or false on has depending on if the key exists", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		expect(cache.has(key)).toBe(false);
		cache.set(key, faker.lorem.word());
		const has = cache.has(key);
		expect(has).toBe(true);
	});

	test("has() should return false for expired keys (issue #1617)", async () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word(), 0.05);
		expect(cache.has(key)).toBe(true);
		await sleep(100);
		expect(cache.has(key)).toBe(false);
	});

	test("has() should emit expired and delete when deleteOnExpire is true", async () => {
		const cache = new NodeCache<string>({
			checkperiod: 0,
			deleteOnExpire: true,
		});
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		cache.set(key, value, 0.05);
		let expiredKey: string | undefined;
		let expiredValue: string | undefined;
		cache.on("expired", (k, v) => {
			expiredKey = k;
			expiredValue = v;
		});
		await sleep(100);
		expect(cache.has(key)).toBe(false);
		expect(expiredKey).toBe(key);
		expect(expiredValue).toBe(value);
		expect(cache.keys()).not.toContain(key);
	});

	test("has() should not delete expired keys when deleteOnExpire is false", async () => {
		const cache = new NodeCache<string>({
			checkperiod: 0,
			deleteOnExpire: false,
		});
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word(), 0.05);
		await sleep(100);
		// has() still reports false because the key is expired
		expect(cache.has(key)).toBe(false);
		// But the underlying entry is still in the store
		expect(cache.keys()).toContain(key);
	});

	test("expired event fires on every access while deleteOnExpire is false", async () => {
		const cache = new NodeCache<string>({
			checkperiod: 0,
			deleteOnExpire: false,
		});
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word(), 0.05);
		let count = 0;
		cache.on("expired", () => {
			count++;
		});
		await sleep(100);
		cache.has(key);
		cache.has(key);
		cache.get(key);
		cache.get(key);
		// Exercise the interval sweep path explicitly
		// biome-ignore lint/complexity/useLiteralKeys: accessing private method for testing
		(cache as unknown as { checkData: () => void })["checkData"]();
		expect(count).toBe(5);
	});

	test("should return the stats of the cache", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		const missingKey = faker.string.uuid();
		cache.set(key1, faker.lorem.word());
		const stats = cache.getStats();
		expect(stats.keys).toBe(1);
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(0);
		cache.set(key2, faker.lorem.word());
		cache.get(key2);
		cache.get(key1);
		cache.get(missingKey);
		const newStats = cache.getStats();
		expect(newStats.keys).toBe(2);
		expect(newStats.hits).toBe(2);
		expect(newStats.misses).toBe(1);
		expect(newStats.vsize).toBeGreaterThan(0);
		expect(newStats.ksize).toBeGreaterThan(0);
		cache.flushStats();
		expect(cache.getStats().keys).toBe(0);
	});

	test("should not inflate ksize/vsize when overwriting an existing key", () => {
		const key = faker.string.uuid();
		const firstValue = faker.lorem.word();
		const secondValue = faker.lorem.words(6);

		const overwrittenCache = new NodeCache<string>({ checkperiod: 0 });
		overwrittenCache.set(key, firstValue);
		overwrittenCache.set(key, secondValue);

		const baselineCache = new NodeCache<string>({ checkperiod: 0 });
		baselineCache.set(key, secondValue);

		const overwrittenStats = overwrittenCache.getStats();
		const baselineStats = baselineCache.getStats();

		expect(overwrittenStats.keys).toBe(1);
		expect(overwrittenStats.ksize).toBe(baselineStats.ksize);
		expect(overwrittenStats.vsize).toBe(baselineStats.vsize);

		overwrittenCache.del(key);
		const statsAfterDelete = overwrittenCache.getStats();
		expect(statsAfterDelete.keys).toBe(0);
		expect(statsAfterDelete.ksize).toBe(0);
		expect(statsAfterDelete.vsize).toBe(0);
	});

	test("should fully clear ksize/vsize after overwritten key expires", async () => {
		const cache = new NodeCache<string>({
			checkperiod: 0,
			deleteOnExpire: true,
		});
		const key = faker.string.uuid();

		cache.set(key, faker.lorem.word());
		cache.set(key, faker.lorem.word(), 0.05);

		await sleep(100);
		expect(cache.get(key)).toBe(undefined);

		const stats = cache.getStats();
		expect(stats.keys).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.vsize).toBe(0);
	});

	test("should flush all the keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		const key3 = faker.string.uuid();
		const numKey = faker.number.int({ min: 1, max: 9999 });
		cache.set(key1, faker.lorem.word());
		cache.set(key2, true);
		cache.set(key3, 1);
		cache.set(numKey, faker.lorem.word());
		expect(cache.get(key2)).toBe(true);
		expect(cache.get(numKey)).toBeDefined();
		expect(cache.get(key3)).toBe(1);
		cache.flushAll();
		expect(cache.keys()).toEqual([]);
		expect(cache.getStats().keys).toBe(0);
	});

	test("should throw an error on maxKeys", () => {
		const cache = new NodeCache({ checkperiod: 0, maxKeys: 1 });
		cache.set(faker.string.uuid(), faker.lorem.word());
		expect(() =>
			cache.set(faker.string.uuid(), faker.lorem.word()),
		).toThrowError("Cache max keys amount exceeded");
	});

	test("should be able to get when an ttl is 0", async () => {
		const cache = new NodeCache({ checkperiod: 0, useClones: false });
		const key1 = faker.string.uuid();
		const value1 = faker.lorem.word();
		const key2 = faker.string.uuid();
		const value2 = faker.lorem.word();
		const key3 = faker.string.uuid();
		cache.set(key1, value1, 100);
		cache.set(key2, value2, 0);
		cache.set(key3, faker.lorem.word(), 0.5);
		expect(cache.get(key1)).toBe(value1);
		expect(cache.get(key2)).toBe(value2);
		await sleep(600);
		expect(cache.get(key3)).toBe(undefined);
	});

	test("should cache indefinitely when ttl is explicitly 0 even with stdTTL set", async () => {
		const cache = new NodeCache({ checkperiod: 0, stdTTL: 0.5 });
		const expiringKey = faker.string.uuid();
		const unlimitedKey = faker.string.uuid();
		const unlimitedValue = faker.lorem.word();
		cache.set(expiringKey, faker.lorem.word()); // omitted ttl → uses stdTTL
		cache.set(unlimitedKey, unlimitedValue, 0); // explicit 0 → cache indefinitely
		await sleep(600);
		expect(cache.get(expiringKey)).toBe(undefined);
		expect(cache.get(unlimitedKey)).toBe(unlimitedValue);
	});

	test("should store key with negative ttl but it expires immediately on access", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		const result = cache.set(key, faker.lorem.word(), -1);
		expect(result).toBe(true);
		// has() treats the expired key as absent (matches node-cache behavior)
		expect(cache.has(key)).toBe(false);
		// get() also sees it's expired and returns undefined
		expect(cache.get(key)).toBe(undefined);
		expect(cache.has(key)).toBe(false);
	});

	test("should expire key immediately when ttl() is called with negative ttl", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word());
		const result = cache.ttl(key, -1);
		expect(result).toBe(true);
		// has() treats the expired key as absent
		expect(cache.has(key)).toBe(false);
		expect(cache.get(key)).toBe(undefined);
		expect(cache.has(key)).toBe(false);
	});

	test("should store but expire immediately when negative TTL is passed as a numeric string in set()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		const result = cache.set(key, faker.lorem.word(), "-1");
		expect(result).toBe(true);
		expect(cache.has(key)).toBe(false);
		expect(cache.get(key)).toBe(undefined);
		expect(cache.has(key)).toBe(false);
	});

	test("should expire immediately when negative TTL is passed as a numeric string in ttl()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word());
		const result = cache.ttl(key, "-5");
		expect(result).toBe(true);
		expect(cache.has(key)).toBe(false);
		expect(cache.get(key)).toBe(undefined);
		expect(cache.has(key)).toBe(false);
	});

	test("should set unlimited expiration on ttl() method when ttl is 0", async () => {
		const cache = new NodeCache({ checkperiod: 0, stdTTL: 0.5 });
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		cache.set(key, value); // uses stdTTL (0.5s)
		cache.ttl(key, 0); // override to unlimited
		await sleep(600);
		expect(cache.get(key)).toBe(value);
		expect(cache.getTtl(key)).toBe(0);
	});

	test("should treat zero-duration string stdTTL as unlimited", () => {
		const cache = new NodeCache({ checkperiod: 0, stdTTL: "0ms" });
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		cache.set(key, value);
		expect(cache.getTtl(key)).toBe(0);
		expect(cache.get(key)).toBe(value);
	});

	test("should use stdTTL when ttl() is called without ttl argument and stdTTL is set", () => {
		const cache = new NodeCache({ checkperiod: 0, stdTTL: 60 });
		const key = faker.string.uuid();
		cache.set(key, faker.lorem.word(), 0); // explicit 0 = unlimited
		expect(cache.getTtl(key)).toBe(0);
		cache.ttl(key); // no ttl arg → fall back to stdTTL (60s)
		const ttl = cache.getTtl(key);
		expect(ttl).toBeGreaterThan(0);
	});

	test("should get the internal id and stop the interval", () => {
		const cache = new NodeCache();
		expect(cache.getIntervalId()).toBeDefined();
		cache.close();
		expect(cache.getIntervalId()).toBe(0);
	});

	test("set object as a value in cache", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		const object = { [faker.string.uuid()]: faker.lorem.word() };
		cache.set(key, object);
		expect(cache.get(key)).toEqual(object);
	});

	test("should check if the cache is expired", async () => {
		const cache = new NodeCache({ checkperiod: 1 });
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		cache.set(key, value, 0.25);
		expect(cache.get(key)).toBe(value);
		await sleep(1000);
		expect(cache.get(key)).toBe(undefined);
		cache.close();
	});

	test("should handle short hand ttl", async () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		cache.set(key, value, "0.25s");
		expect(cache.get(key)).toBe(value);
		await sleep(300);
		expect(cache.get(key)).toBe(undefined);
	});

	test("should handle short hand via stdTTL", async () => {
		const cache = new NodeCache({ checkperiod: 0, stdTTL: "0.25s" });
		const key = faker.string.uuid();
		const value = faker.lorem.word();
		cache.set(key, value);
		expect(cache.get(key)).toBe(value);
		await sleep(300);
		expect(cache.get(key)).toBe(undefined);
		cache.close();
	});

	test("should not delete if expired even on interval", async () => {
		const cache = new NodeCache<string>({
			checkperiod: 1,
			deleteOnExpire: false,
		});
		let expiredKey = "";
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		cache.on("expired", (key) => {
			expiredKey = key as string;
		});
		cache.set(key1, faker.lorem.word(), 0.25);
		cache.set(key2, faker.lorem.word(), 2);
		expect(cache.getStats().keys).toBe(2);
		await sleep(1000);
		expect(cache.getStats().keys).toBe(2);
		expect(expiredKey).toBe(key1);
		const expiredValue = cache.get(key1);
		expect(expiredValue).toBe(undefined);
		cache.close();
	});

	test("should handle null values with cloning", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const key = faker.string.uuid();
		cache.set(key, null);
		expect(cache.get(key)).toBe(null);
	});

	test("should propagate class-level generic type through mget and take", () => {
		type MyType = { name: string; age: number };
		const cache = new NodeCache<MyType>({ checkperiod: 0 });
		const key1 = faker.string.uuid();
		const key2 = faker.string.uuid();
		const name1 = faker.person.firstName();
		const age1 = faker.number.int({ min: 1, max: 100 });
		const name2 = faker.person.firstName();
		const age2 = faker.number.int({ min: 1, max: 100 });
		cache.set(key1, { name: name1, age: age1 });
		cache.set(key2, { name: name2, age: age2 });

		const mgetResult = cache.mget([key1, key2]);
		// Verify the type is correctly inferred as Record<string, MyType | undefined>
		const user1 = mgetResult[key1];
		expect(user1).toBeDefined();
		expect(user1!.name).toBe(name1);
		expect(user1!.age).toBe(age1);

		const taken = cache.take(key2);
		// Verify the type is correctly inferred as MyType | undefined
		expect(taken).toBeDefined();
		expect(taken!.name).toBe(name2);
		expect(taken!.age).toBe(age2);

		// Verify take removed the key
		expect(cache.get(key2)).toBeUndefined();
	});
});
