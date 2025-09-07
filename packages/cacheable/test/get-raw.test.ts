import { sleep } from "@cacheable/utils";
import { Keyv } from "keyv";
import { describe, expect, test, vi } from "vitest";
import { Cacheable, CacheableEvents, CacheableHooks } from "../src/index.js";

describe("cacheable getRaw method", async () => {
	test("should get raw data object from primary store", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("rawKey", "rawValue");
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

		cacheable.onHook(CacheableHooks.BEFORE_GET, async (key) => {
			beforeGetCalled = true;
			expect(key).toBe("hookKey");
		});

		cacheable.onHook(CacheableHooks.AFTER_GET, async (item) => {
			afterGetCalled = true;
			expect(item.key).toBe("hookKey");
		});

		await cacheable.set("hookKey", "hookValue");
		await cacheable.getRaw("hookKey");

		expect(beforeGetCalled).toBe(true);
		expect(afterGetCalled).toBe(true);
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
		const cacheable = new Cacheable({ secondary: keyv });
		cacheable.on(CacheableEvents.ERROR, (error) => {
			expect(error).toBeDefined();
			errorReceived = true;
		});

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

	test("should maintain consistency with get method raw option", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("consistencyKey", "consistencyValue");

		const getRawResult = await cacheable.getRaw("consistencyKey");
		const getWithRawResult = await cacheable.get("consistencyKey", {
			raw: true,
		});

		expect(getRawResult).toEqual(getWithRawResult);
	});
});
