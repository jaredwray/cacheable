// biome-ignore-all lint/style/noNonNullAssertion: test file
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
		cache.on("set", (key, value) => {
			expect(key).toBe("foo");
			expect(value).toBe("bar");
		});
		cache.set("foo", "bar");
		expect(cache.get("foo")).toBe("bar");
	});

	test("should set and get a key with ttl", async () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar", 0.5);
		cache.set("baz", "qux");
		await sleep(600);
		expect(cache.get("foo")).toBe(undefined);
		expect(cache.get("baz")).toBe("qux");
	});

	test("should set multiple cache items", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const list = [
			{ key: "foo", value: "bar" },
			{ key: "baz", value: "qux" },
		];
		cache.mset(list);
		expect(cache.get("foo")).toBe("bar");
		expect(cache.get("baz")).toBe("qux");
	});

	test("should get multiple cache items", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar");
		cache.set("baz", "qux");
		const list = cache.mget(["foo", "baz"]);
		expect(list.foo).toBe("bar");
		expect(list.baz).toBe("qux");
	});

	test("should take a key", () => {
		cache.set("foo", "bar");
		const value = cache.take("foo")!;
		expect(value).toBe("bar");
		expect(cache.get("foo")).toBe(undefined);
	});

	test("should take a key with useClones set to false", () => {
		const cache = new NodeCache({ checkperiod: 0, useClones: false });
		cache.set("foo", "bar");
		const value = cache.take("foo")!;
		expect(value).toBe("bar");
		expect(cache.get("foo")).toBe(undefined);
	});

	test("should take a key and be undefined", () => {
		expect(cache.take("foo")).toBe(undefined);
	});

	test("should delete a key", () => {
		cache.set("foo", "bar");
		cache.del("foo");
		expect(cache.get("foo")).toBe(undefined);
	});

	test("should use del() to delete multiple keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const list = [
			{ key: "foo", value: "bar" },
			{ key: "baz", value: "qux" },
		];
		cache.mset(list);
		cache.set("foo2", "bar1");
		const resultCount = cache.del(["foo2", "baz"]);
		expect(resultCount).toBe(2);
		expect(cache.get("foo")).toBe("bar");
	});

	test("should delete multiple keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const list = [
			{ key: "foo", value: "bar" },
			{ key: "baz", value: "qux" },
		];
		cache.mset(list);
		cache.set("foo", "bar");
		cache.set("baz", "qux");
		cache.mdel(["foo", "baz"]);
		expect(cache.get("foo")).toBe(undefined);
		expect(cache.get("baz")).toBe(undefined);
	});

	test("should get the ttl / expiration of a key", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar", 10);
		const firstTtl = cache.getTtl("foo")!;
		expect(firstTtl).toBeDefined();
		cache.ttl("foo", 15);
		const secondTtl = cache.getTtl("foo");
		expect(firstTtl).toBeLessThan(secondTtl!);
	});

	test("should get undefined when on getTtl()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const ttl = cache.getTtl("foo");
		expect(ttl).toBe(undefined);
	});

	test("ttl should default to 0 if no ttl is set", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar"); // Set to 10 by stdTTL
		const ttl = cache.getTtl("foo");
		expect(ttl).toBe(0);
		cache.ttl("foo");
		const ttl2 = cache.getTtl("foo");
		expect(ttl2).toBeGreaterThan(ttl!);
	});

	test("should return 0 if there is no key to delete", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const count = cache.del("foo");
		expect(count).toBe(0);
	});

	test("should return the correct count on mdel()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const list = [
			{ key: "foo", value: "bar" },
			{ key: "baz", value: "qux" },
		];
		cache.mset(list);
		const count = cache.mdel(["foo", "baz", "qux"]);
		expect(count).toBe(2);
	});

	test("it should return a 0 if there is no ttl set", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar");
		const ttl = cache.getTtl("foo");
		expect(ttl).toBe(0);
	});

	test("should return false if there is no key on ttl()", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const ttl = cache.ttl("foo", 10);
		expect(ttl).toBe(false);
	});

	test("should return an array of keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar");
		cache.set("baz", "qux");
		const keys = cache.keys();
		expect(keys).toEqual(["foo", "baz"]);
	});

	test("should return true or false on has depending on if the key exists", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		expect(cache.has("foo")).toBe(false);
		cache.set("foo", "bar");
		const has = cache.has("foo");
		expect(has).toBe(true);
	});

	test("should return the stats of the cache", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar");
		const stats = cache.getStats();
		expect(stats.keys).toBe(1);
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(0);
		cache.set("new", "value");
		cache.get("new");
		cache.get("foo");
		cache.get("foo2");
		const newStats = cache.getStats();
		expect(newStats.keys).toBe(2);
		expect(newStats.hits).toBe(2);
		expect(newStats.misses).toBe(1);
		expect(newStats.vsize).toBeGreaterThan(0);
		expect(newStats.ksize).toBeGreaterThan(0);
		cache.flushStats();
		expect(cache.getStats().keys).toBe(0);
	});

	test("should flush all the keys", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar");
		cache.set("baz", true);
		cache.set("n", 1);
		cache.set(220, "value");
		expect(cache.get("baz")).toBe(true);
		expect(cache.get(220)).toBe("value");
		expect(cache.get("n")).toBe(1);
		cache.flushAll();
		expect(cache.keys()).toEqual([]);
		expect(cache.getStats().keys).toBe(0);
	});

	test("should throw an error on maxKeys", () => {
		const cache = new NodeCache({ checkperiod: 0, maxKeys: 1 });
		cache.set("foo", "bar");
		expect(() => cache.set("baz", "qux")).toThrowError(
			"Cache max keys amount exceeded",
		);
	});

	test("should be able to get when an ttl is 0", async () => {
		const cache = new NodeCache({ checkperiod: 0, useClones: false });
		cache.set("foo", "bar", 100);
		cache.set("baz", "qux", 0);
		cache.set("moo", "moo", 0.5);
		expect(cache.get("foo")).toBe("bar");
		expect(cache.get("baz")).toBe("qux");
		await sleep(600);
		expect(cache.get("moo")).toBe(undefined);
	});

	test("should get the internal id and stop the interval", () => {
		const cache = new NodeCache();
		expect(cache.getIntervalId()).toBeDefined();
		cache.close();
		expect(cache.getIntervalId()).toBe(0);
	});

	test("set object as a value in cache", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		const object = { foo: "bar" };
		cache.set("foo", object);
		expect(cache.get("foo")).toEqual(object);
	});

	test("should check if the cache is expired", async () => {
		const cache = new NodeCache({ checkperiod: 1 });
		cache.set("foo", "bar", 0.25);
		expect(cache.get("foo")).toBe("bar");
		await sleep(1000);
		expect(cache.get("foo")).toBe(undefined);
		cache.close();
	});

	test("should handle short hand ttl", async () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("foo", "bar", "0.25s");
		expect(cache.get("foo")).toBe("bar");
		await sleep(300);
		expect(cache.get("foo")).toBe(undefined);
	});

	test("should handle short hand via stdTTL", async () => {
		const cache = new NodeCache({ checkperiod: 0, stdTTL: "0.25s" });
		cache.set("foo", "bar");
		expect(cache.get("foo")).toBe("bar");
		await sleep(300);
		expect(cache.get("foo")).toBe(undefined);
		cache.close();
	});

	test("should not delete if expired even on interval", async () => {
		const cache = new NodeCache<string>({
			checkperiod: 1,
			deleteOnExpire: false,
		});
		let expiredKey = "";
		cache.on("expired", (key) => {
			expiredKey = key as string;
		});
		cache.set("foo-expired", "bar", 0.25);
		cache.set("baz-expired", "qux", 2);
		expect(cache.getStats().keys).toBe(2);
		await sleep(1000);
		expect(cache.getStats().keys).toBe(2);
		expect(expiredKey).toBe("foo-expired");
		const expiredValue = cache.get("foo-expired");
		expect(expiredValue).toBe(undefined);
		cache.close();
	});

	test("should handle null values with cloning", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		cache.set("nullKey", null);
		expect(cache.get("nullKey")).toBe(null);
	});
});
