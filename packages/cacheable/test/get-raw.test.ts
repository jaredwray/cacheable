import { sleep } from "@cacheable/utils";
import { Keyv } from "keyv";
import { describe, expect, test, vi } from "vitest";
import { Cacheable, CacheableEvents, CacheableHooks } from "../src/index.js";

describe("cacheable getRaw method", async () => {
	test("should get raw data object from primary store", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("rawKey", "rawValue", 10);
		const raw = await cacheable.getRaw("rawKey");
		expect(raw).toHaveProperty("value", "rawValue");
		expect(raw).toHaveProperty("expires");
	});

	test("should get raw data object from secondary store", async () => {
		const secondary = new Keyv();
		await secondary.set("secondaryKey", "secondaryValue");
		const cacheable = new Cacheable({ secondary });
		const raw = await cacheable.getRaw("secondaryKey");
		expect(raw).toHaveProperty("value", "secondaryValue");
		// Check if we have a raw data object structure
		expect(typeof raw).toBe("object");
		expect(raw).not.toBeNull();
	});

	test("should return undefined for non-existent key", async () => {
		const cacheable = new Cacheable();
		const raw = await cacheable.getRaw("nonExistentKey");
		expect(raw).toBeUndefined();
	});

	test("should handle typed values", async () => {
		const cacheable = new Cacheable();
		const testObject = { id: 1, name: "test" };
		await cacheable.set("objectKey", testObject);
		const raw = await cacheable.getRaw<typeof testObject>("objectKey");
		expect(raw).toHaveProperty("value", testObject);
		expect(raw?.value?.id).toBe(1);
		expect(raw?.value?.name).toBe("test");
	});

	test("should work with TTL expiration", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("ttlKey", "ttlValue", 10);
		const raw = await cacheable.getRaw("ttlKey");
		expect(raw).toHaveProperty("value", "ttlValue");
		expect(raw).toHaveProperty("expires");
		expect(typeof raw?.expires).toBe("number");
		expect(raw?.expires).toBeGreaterThan(Date.now());
	});

	test("should trigger BEFORE_GET and AFTER_GET hooks", async () => {
		const cacheable = new Cacheable();
		let beforeGetCalled = false;
		let afterGetCalled = false;

		cacheable.onHook(CacheableHooks.BEFORE_GET, async (_key) => {
			beforeGetCalled = true;
		});

		cacheable.onHook(CacheableHooks.AFTER_GET, async (_item) => {
			afterGetCalled = true;
		});

		await cacheable.set("hookKey", "hookValue");
		const raw = await cacheable.getRaw("hookKey");

		// getRaw now triggers hooks since it contains the full implementation
		expect(beforeGetCalled).toBe(true);
		expect(afterGetCalled).toBe(true);
		expect(raw?.value).toBe("hookValue");
	});

	test("should emit cache:hit event from primary store", async () => {
		const cacheable = new Cacheable();
		const events: Array<{ key: string; value: unknown; store: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			events.push(event);
		});

		await cacheable.set("eventKey", "eventValue");
		const raw = await cacheable.getRaw("eventKey");

		expect(raw?.value).toBe("eventValue");
		// getRaw now emits events since it contains the full implementation
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			key: "eventKey",
			value: "eventValue",
			store: "primary",
		});
	});

	test("should emit cache:hit event from secondary store", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const events: Array<{ key: string; value: unknown; store: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			events.push(event);
		});

		await secondary.set("secEventKey", "secEventValue");
		const raw = await cacheable.getRaw("secEventKey");

		expect(raw?.value).toBe("secEventValue");
		// getRaw now emits events since it contains the full implementation
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			key: "secEventKey",
			value: "secEventValue",
			store: "secondary",
		});
	});

	test("should emit cache:miss event for non-existent key", async () => {
		const cacheable = new Cacheable();
		const events: Array<{ key: string; store?: string }> = [];

		cacheable.on(CacheableEvents.CACHE_MISS, (event) => {
			events.push(event);
		});

		const raw = await cacheable.getRaw("missKey");

		expect(raw).toBeUndefined();
		// getRaw now emits events since it contains the full implementation
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({
			key: "missKey",
			store: "primary",
		});
	});

	test("should update stats when enabled", async () => {
		const cacheable = new Cacheable({ stats: true });

		// Test miss
		await cacheable.getRaw("statsMissKey");
		expect(cacheable.stats.gets).toBe(1);
		expect(cacheable.stats.misses).toBe(1);
		expect(cacheable.stats.hits).toBe(0);

		// Test hit
		await cacheable.set("statsHitKey", "statsValue");
		await cacheable.getRaw("statsHitKey");
		// getRaw now updates stats since it contains the full implementation
		expect(cacheable.stats.gets).toBe(2);
		expect(cacheable.stats.misses).toBe(1);
		expect(cacheable.stats.hits).toBe(1);
	});

	test("should handle errors gracefully", async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, "getRaw").mockImplementation(async () => {
			throw new Error("getRaw error");
		});

		let errorReceived = false;
		const cacheable = new Cacheable({ primary: keyv });
		cacheable.on(CacheableEvents.ERROR, (_error) => {
			errorReceived = true;
		});

		// getRaw now handles errors gracefully since it contains the full implementation
		const raw = await cacheable.getRaw("errorKey");
		expect(raw).toBeUndefined();
		expect(errorReceived).toBe(true);
	});

	test("should propagate value from secondary to primary", async () => {
		const secondary = new Keyv();
		await secondary.set("propagateKey", "propagateValue");

		const cacheable = new Cacheable({ secondary });
		const raw = await cacheable.getRaw("propagateKey");

		expect(raw?.value).toBe("propagateValue");

		// Verify it was copied to primary
		const primaryRaw = await cacheable.primary.getRaw("propagateKey");
		expect(primaryRaw?.value).toBe("propagateValue");
	});

	test("should handle expired keys", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("expiredKey", "expiredValue", 1);
		await sleep(5);
		const raw = await cacheable.getRaw("expiredKey");
		expect(raw).toBeUndefined();
	});

	test("should provide raw data while get returns value only", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("consistencyKey", "consistencyValue");

		const getRawResult = await cacheable.getRaw("consistencyKey");
		const getResult = await cacheable.get("consistencyKey");

		expect(getRawResult?.value).toEqual(getResult);
		expect(getRawResult).toHaveProperty("value", "consistencyValue");
		expect(getResult).toBe("consistencyValue");
	});
});

describe("cacheable getManyRaw method", async () => {
	test("should get multiple raw data objects from primary store", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("key1", "value1");
		await cacheable.set("key2", "value2");

		const raws = await cacheable.getManyRaw(["key1", "key2"]);

		expect(raws).toHaveLength(2);
		expect(raws[0]).toHaveProperty("value", "value1");
		expect(raws[1]).toHaveProperty("value", "value2");
		expect(typeof raws[0]).toBe("object");
		expect(typeof raws[1]).toBe("object");
	});

	test("should get mixed results with some from secondary store", async () => {
		const secondary = new Keyv();
		await secondary.set("secKey", "secValue");

		const cacheable = new Cacheable({ secondary });
		await cacheable.set("primaryKey", "primaryValue");

		const raws = await cacheable.getManyRaw(["primaryKey", "secKey"]);

		expect(raws).toHaveLength(2);
		expect(raws[0]).toHaveProperty("value", "primaryValue");
		expect(raws[1]).toHaveProperty("value", "secValue");
	});

	test("should handle missing keys with undefined", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("existingKey", "existingValue");

		const raws = await cacheable.getManyRaw(["existingKey", "missingKey"]);

		expect(raws).toHaveLength(2);
		expect(raws[0]).toHaveProperty("value", "existingValue");
		expect(raws[1]).toBeUndefined();
	});

	test("should handle empty keys array", async () => {
		const cacheable = new Cacheable();
		const raws = await cacheable.getManyRaw([]);
		expect(raws).toEqual([]);
	});

	test("should work with typed values", async () => {
		const cacheable = new Cacheable();
		const obj1 = { id: 1, name: "first" };
		const obj2 = { id: 2, name: "second" };

		await cacheable.set("obj1", obj1);
		await cacheable.set("obj2", obj2);

		const raws = await cacheable.getManyRaw<typeof obj1>(["obj1", "obj2"]);

		expect(raws).toHaveLength(2);
		expect(raws[0]?.value).toEqual(obj1);
		expect(raws[1]?.value).toEqual(obj2);
	});

	test("should work with TTL expiration", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("ttlKey1", "ttlValue1", 10);
		await cacheable.set("ttlKey2", "ttlValue2", 10);

		const raws = await cacheable.getManyRaw(["ttlKey1", "ttlKey2"]);

		expect(raws).toHaveLength(2);
		expect(raws[0]).toHaveProperty("value", "ttlValue1");
		expect(raws[1]).toHaveProperty("value", "ttlValue2");
		expect(typeof raws[0]?.expires).toBe("number");
		expect(typeof raws[1]?.expires).toBe("number");
		expect(raws[0]?.expires).toBeGreaterThan(Date.now());
		expect(raws[1]?.expires).toBeGreaterThan(Date.now());
	});

	test("should trigger BEFORE_GET_MANY and AFTER_GET_MANY hooks", async () => {
		const cacheable = new Cacheable();
		let beforeGetManyCalled = false;
		let afterGetManyCalled = false;
		const testKeys = ["hookKey1", "hookKey2"];

		cacheable.onHook(CacheableHooks.BEFORE_GET_MANY, async (_keys) => {
			beforeGetManyCalled = true;
		});

		cacheable.onHook(CacheableHooks.AFTER_GET_MANY, async (_item) => {
			afterGetManyCalled = true;
		});

		await cacheable.setMany([
			{ key: "hookKey1", value: "hookValue1" },
			{ key: "hookKey2", value: "hookValue2" },
		]);
		const raws = await cacheable.getManyRaw(testKeys);

		// getManyRaw now triggers hooks since it contains the full implementation
		expect(beforeGetManyCalled).toBe(true);
		expect(afterGetManyCalled).toBe(true);
		expect(raws).toHaveLength(2);
	});

	test("should emit cache:hit and cache:miss events", async () => {
		const cacheable = new Cacheable();
		const hitEvents: Array<{ key: string; value: unknown; store: string }> = [];
		const missEvents: Array<{ key: string; store?: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			hitEvents.push(event);
		});

		cacheable.on(CacheableEvents.CACHE_MISS, (event) => {
			missEvents.push(event);
		});

		await cacheable.set("hitKey", "hitValue");
		const raws = await cacheable.getManyRaw(["hitKey", "missKey"]);

		expect(raws).toHaveLength(2);
		expect(raws[0]?.value).toBe("hitValue");
		expect(raws[1]).toBeUndefined();

		// getManyRaw now emits events since it contains the full implementation
		expect(hitEvents).toHaveLength(1);
		expect(hitEvents[0]).toEqual({
			key: "hitKey",
			value: "hitValue",
			store: "primary",
		});

		expect(missEvents).toHaveLength(1);
		expect(missEvents[0]).toEqual({
			key: "missKey",
			store: "primary",
		});
	});

	test("should emit cache:hit from secondary store", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const hitEvents: Array<{ key: string; value: unknown; store: string }> = [];

		cacheable.on(CacheableEvents.CACHE_HIT, (event) => {
			hitEvents.push(event);
		});

		await secondary.set("secondaryHitKey", "secondaryHitValue");
		const raws = await cacheable.getManyRaw(["secondaryHitKey"]);

		expect(raws[0]?.value).toBe("secondaryHitValue");
		// getManyRaw now emits events since it contains the full implementation
		expect(hitEvents).toHaveLength(1);
		expect(hitEvents[0]).toEqual({
			key: "secondaryHitKey",
			value: "secondaryHitValue",
			store: "secondary",
		});
	});

	test("should update stats when enabled", async () => {
		const cacheable = new Cacheable({ stats: true });

		// Test with mix of hits and misses
		await cacheable.set("statsKey1", "statsValue1");
		await cacheable.getManyRaw(["statsKey1", "statsMissKey1", "statsMissKey2"]);

		// getManyRaw now updates stats since it contains the full implementation
		expect(cacheable.stats.gets).toBe(1);
		expect(cacheable.stats.hits).toBe(1);
		expect(cacheable.stats.misses).toBe(2);
	});

	test("should handle errors gracefully", async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, "getManyRaw").mockImplementation(async () => {
			throw new Error("getManyRaw error");
		});

		let errorReceived = false;
		const cacheable = new Cacheable({ primary: keyv });
		cacheable.on(CacheableEvents.ERROR, (_error) => {
			errorReceived = true;
		});

		// getManyRaw now handles errors gracefully since it contains the full implementation
		const raws = await cacheable.getManyRaw(["errorKey1", "errorKey2"]);
		expect(raws).toEqual([]);
		expect(errorReceived).toBe(true);
	});

	test("should propagate values from secondary to primary", async () => {
		const secondary = new Keyv();
		await secondary.set("propagateKey1", "propagateValue1");
		await secondary.set("propagateKey2", "propagateValue2");

		const cacheable = new Cacheable({ secondary });
		const raws = await cacheable.getManyRaw(["propagateKey1", "propagateKey2"]);

		expect(raws).toHaveLength(2);
		expect(raws[0]?.value).toBe("propagateValue1");
		expect(raws[1]?.value).toBe("propagateValue2");

		// Verify they were copied to primary
		const primaryRaws = await cacheable.primary.getManyRaw([
			"propagateKey1",
			"propagateKey2",
		]);
		expect(primaryRaws[0]?.value).toBe("propagateValue1");
		expect(primaryRaws[1]?.value).toBe("propagateValue2");
	});

	test("should provide raw data while getMany returns values only", async () => {
		const cacheable = new Cacheable();
		await cacheable.setMany([
			{ key: "consistKey1", value: "consistValue1" },
			{ key: "consistKey2", value: "consistValue2" },
		]);

		const getManyRawResult = await cacheable.getManyRaw([
			"consistKey1",
			"consistKey2",
		]);
		const getManyResult = await cacheable.getMany([
			"consistKey1",
			"consistKey2",
		]);

		expect(getManyRawResult.map((item) => item?.value)).toEqual(getManyResult);
		expect(getManyRawResult).toHaveLength(2);
		expect(getManyResult).toEqual(["consistValue1", "consistValue2"]);
	});
});
