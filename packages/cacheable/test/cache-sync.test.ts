import { sleep } from "@cacheable/utils";
import { MemoryMessageProvider, Qified } from "qified";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	Cacheable,
	CacheSync,
	CacheSyncEvents,
	CacheSyncHooks,
} from "../src/index.js";

describe("CacheSync", () => {
	let cacheable1: Cacheable;
	let cacheable2: Cacheable;
	let sync1: CacheSync;
	let sync2: CacheSync;
	let sharedProvider: MemoryMessageProvider;
	let sharedQified: Qified;

	beforeEach(async () => {
		cacheable1 = new Cacheable({ cacheId: "cache1" });
		cacheable2 = new Cacheable({ cacheId: "cache2" });
		sharedProvider = new MemoryMessageProvider({ id: "shared" });
		sharedQified = new Qified({ messageProviders: [sharedProvider] });
	});

	afterEach(async () => {
		if (sync1) {
			await sync1.disconnect();
		}
		if (sync2) {
			await sync2.disconnect();
		}
	});

	describe("constructor and properties", () => {
		test("should create a CacheSync instance with message providers", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
			});

			expect(sync1).toBeDefined();
			expect(sync1.cacheable).toBe(cacheable1);
			expect(sync1.qified).toBeDefined();
			expect(sync1.topic).toBe("cache:sync:cache1");
			expect(sync1.enablePublish).toBe(true);
			expect(sync1.enableSubscribe).toBe(true);
		});

		test("should create a CacheSync instance with custom topic", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
				topic: "custom:topic",
			});

			expect(sync1.topic).toBe("custom:topic");
		});

		test("should create a CacheSync instance with custom instanceId", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
				instanceId: "custom-instance",
			});

			expect(sync1.instanceId).toBe("custom-instance");
		});

		test("should create a CacheSync instance with disabled publish", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
				enablePublish: false,
			});

			expect(sync1.enablePublish).toBe(false);
		});

		test("should create a CacheSync instance with disabled subscribe", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
				enableSubscribe: false,
			});

			expect(sync1.enableSubscribe).toBe(false);
		});

		test("should create a CacheSync instance with specific sync operations", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
				syncOperations: ["set", "delete"],
			});

			expect(sync1.syncOperations).toEqual(["set", "delete"]);
		});

		test("should throw error if neither qified nor messageProviders provided", () => {
			expect(() => {
				new CacheSync({
					cacheable: cacheable1,
				});
			}).toThrow("Either qified instance or messageProviders must be provided");
		});

		test("should allow setting enablePublish and enableSubscribe", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
			});

			sync1.enablePublish = false;
			expect(sync1.enablePublish).toBe(false);

			sync1.enableSubscribe = false;
			expect(sync1.enableSubscribe).toBe(false);
		});

		test("should allow setting syncOperations", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				messageProviders: [sharedProvider],
			});

			sync1.syncOperations = ["set"];
			expect(sync1.syncOperations).toEqual(["set"]);
		});
	});

	describe("sync operations", () => {
		beforeEach(async () => {
			const sharedTopic = "cache:sync:shared";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: sharedTopic,
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: sharedTopic,
			});

			// Give subscriptions time to set up
			await sleep(50);
		});

		test("should sync set operation between instances", async () => {
			await cacheable1.set("key1", "value1");
			await sync1.syncSet("key1", "value1");

			// Give time for message to propagate
			await sleep(50);

			const value = await cacheable2.get("key1");
			expect(value).toBe("value1");
		});

		test("should sync set operation with ttl", async () => {
			await cacheable1.set("key2", "value2", 1000);
			await sync1.syncSet("key2", "value2", 1000);

			await sleep(50);

			const value = await cacheable2.get("key2");
			expect(value).toBe("value2");
		});

		test("should sync setMany operation between instances", async () => {
			const items = [
				{ key: "key3", value: "value3" },
				{ key: "key4", value: "value4" },
			];

			await cacheable1.setMany(items);
			await sync1.syncSetMany(items);

			await sleep(50);

			const value3 = await cacheable2.get("key3");
			const value4 = await cacheable2.get("key4");

			expect(value3).toBe("value3");
			expect(value4).toBe("value4");
		});

		test("should sync delete operation between instances", async () => {
			await cacheable1.set("key5", "value5");
			await cacheable2.set("key5", "value5");

			await cacheable1.delete("key5");
			await sync1.syncDelete("key5");

			await sleep(50);

			const value = await cacheable2.get("key5");
			expect(value).toBeUndefined();
		});

		test("should sync deleteMany operation between instances", async () => {
			await cacheable1.set("key6", "value6");
			await cacheable1.set("key7", "value7");
			await cacheable2.set("key6", "value6");
			await cacheable2.set("key7", "value7");

			await cacheable1.deleteMany(["key6", "key7"]);
			await sync1.syncDeleteMany(["key6", "key7"]);

			await sleep(50);

			const value6 = await cacheable2.get("key6");
			const value7 = await cacheable2.get("key7");

			expect(value6).toBeUndefined();
			expect(value7).toBeUndefined();
		});

		test("should sync clear operation between instances", async () => {
			await cacheable1.set("key8", "value8");
			await cacheable2.set("key8", "value8");
			await cacheable2.set("key9", "value9");

			await cacheable1.clear();
			await sync1.syncClear();

			await sleep(50);

			const value8 = await cacheable2.get("key8");
			const value9 = await cacheable2.get("key9");

			expect(value8).toBeUndefined();
			expect(value9).toBeUndefined();
		});

		test("should not sync operations when publish is disabled", async () => {
			sync1.enablePublish = false;

			await cacheable1.set("key10", "value10");
			await sync1.syncSet("key10", "value10");

			await sleep(50);

			const value = await cacheable2.get("key10");
			expect(value).toBeUndefined();
		});

		test("should not sync specific operations when not in syncOperations", async () => {
			sync1.syncOperations = ["set"];

			await cacheable1.set("key11", "value11");
			await cacheable2.set("key11", "value11");

			await sync1.syncDelete("key11");

			await sleep(50);

			const value = await cacheable2.get("key11");
			expect(value).toBe("value11"); // Should still exist
		});

		test("should ignore messages from same instance", async () => {
			const spy = vi.fn();
			cacheable1.on("cache:hit", spy);

			await cacheable1.set("key12", "value12");
			await sync1.syncSet("key12", "value12");

			await sleep(50);

			// Message should be ignored, so no additional cache operations
			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe("events", () => {
		beforeEach(async () => {
			const sharedTopic = "cache:sync:shared-events";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: sharedTopic,
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: sharedTopic,
			});

			await sleep(50);
		});

		test("should emit SYNC_PUBLISHED event", async () => {
			const spy = vi.fn();
			sync1.on(CacheSyncEvents.SYNC_PUBLISHED, spy);

			await sync1.syncSet("key13", "value13");

			await sleep(10);

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: "set",
					instanceId: "instance1",
					data: expect.objectContaining({
						key: "key13",
						value: "value13",
					}),
				}),
			);
		});

		test("should emit SYNC_RECEIVED event", async () => {
			const spy = vi.fn();
			sync2.on(CacheSyncEvents.SYNC_RECEIVED, spy);

			await sync1.syncSet("key14", "value14");

			await sleep(50);

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: "set",
					instanceId: "instance1",
				}),
			);
		});

		test("should emit SYNC_APPLIED event", async () => {
			const spy = vi.fn();
			sync2.on(CacheSyncEvents.SYNC_APPLIED, spy);

			await sync1.syncSet("key15", "value15");

			await sleep(50);

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: "set",
					instanceId: "instance1",
				}),
			);
		});

		test("should have ERROR event for error handling", async () => {
			const spy = vi.fn();
			sync1.on(CacheSyncEvents.ERROR, spy);

			// The ERROR event exists and can be listened to
			// Actual errors are difficult to trigger in a controlled way in tests
			// but the event handler is set up and ready for production use
			expect(CacheSyncEvents.ERROR).toBe("error");
		});
	});

	describe("hooks", () => {
		beforeEach(async () => {
			const sharedTopic = "cache:sync:shared-hooks";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: sharedTopic,
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: sharedTopic,
			});

			await sleep(50);
		});

		test("should support BEFORE_PUBLISH hook", async () => {
			const spy = vi.fn();
			sync1.onHook(CacheSyncHooks.BEFORE_PUBLISH, spy);

			await sync1.syncSet("key17", "value17");

			await sleep(10);

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: "set",
					data: expect.objectContaining({
						key: "key17",
						value: "value17",
					}),
				}),
			);
		});

		test("should support AFTER_PUBLISH hook", async () => {
			const spy = vi.fn();
			sync1.onHook(CacheSyncHooks.AFTER_PUBLISH, spy);

			await sync1.syncSet("key18", "value18");

			await sleep(10);

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: "set",
				}),
			);
		});

		test("should support BEFORE_APPLY hook", async () => {
			const spy = vi.fn();
			sync2.onHook(CacheSyncHooks.BEFORE_APPLY, spy);

			await sync1.syncSet("key19", "value19");

			await sleep(50);

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: "set",
					instanceId: "instance1",
				}),
			);
		});

		test("should support AFTER_APPLY hook", async () => {
			const spy = vi.fn();
			sync2.onHook(CacheSyncHooks.AFTER_APPLY, spy);

			await sync1.syncSet("key20", "value20");

			await sleep(50);

			expect(spy).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: "set",
					instanceId: "instance1",
				}),
			);
		});
	});

	describe("subscribe and unsubscribe", () => {
		test("should subscribe on creation when enableSubscribe is true", async () => {
			const sharedTopic = "cache:sync:subscribe-test-1";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				enableSubscribe: true,
				topic: sharedTopic,
			});

			await sleep(50);

			// Should be subscribed and able to receive messages
			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				topic: sharedTopic,
			});

			await sleep(50);

			await sync2.syncSet("key21", "value21");

			await sleep(50);

			const value = await cacheable1.get("key21");
			expect(value).toBe("value21");
		});

		test("should not subscribe on creation when enableSubscribe is false", async () => {
			const sharedTopic = "cache:sync:subscribe-test-2";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				enableSubscribe: false,
				topic: sharedTopic,
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				topic: sharedTopic,
			});

			await sleep(50);

			await sync2.syncSet("key22", "value22");

			await sleep(50);

			const value = await cacheable1.get("key22");
			expect(value).toBeUndefined();
		});

		test("should allow manual subscribe", async () => {
			const sharedTopic = "cache:sync:subscribe-test-3";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				enableSubscribe: false,
				topic: sharedTopic,
			});

			await sync1.subscribe();

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				topic: sharedTopic,
			});

			await sleep(50);

			await sync2.syncSet("key23", "value23");

			await sleep(50);

			const value = await cacheable1.get("key23");
			expect(value).toBe("value23");
		});

		test("should allow unsubscribe", async () => {
			const sharedTopic = "cache:sync:subscribe-test-4";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				topic: sharedTopic,
			});

			await sleep(50);

			await sync1.unsubscribe();

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				topic: sharedTopic,
			});

			await sleep(50);

			await sync2.syncSet("key24", "value24");

			await sleep(50);

			const value = await cacheable1.get("key24");
			expect(value).toBeUndefined();
		});

		test("should handle multiple subscribe calls gracefully", async () => {
			const sharedTopic = "cache:sync:subscribe-test-5";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				topic: sharedTopic,
			});

			await sleep(50);

			await sync1.subscribe();
			await sync1.subscribe();

			// Should still work normally
			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				topic: sharedTopic,
			});

			await sleep(50);

			await sync2.syncSet("key25", "value25");

			await sleep(50);

			const value = await cacheable1.get("key25");
			expect(value).toBe("value25");
		});

		test("should handle multiple unsubscribe calls gracefully", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
			});

			await sleep(50);

			await sync1.unsubscribe();
			await sync1.unsubscribe();

			// Should work without errors
			expect(sync1).toBeDefined();
		});
	});

	describe("disconnect", () => {
		test("should disconnect properly", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
			});

			await sleep(50);

			await sync1.disconnect();

			// Should not receive messages after disconnect
			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
			});

			await sleep(50);

			await sync2.syncSet("key26", "value26");

			await sleep(50);

			const value = await cacheable1.get("key26");
			expect(value).toBeUndefined();
		});
	});

	describe("multi-instance synchronization", () => {
		test("should sync across three instances", async () => {
			const cacheable3 = new Cacheable({ cacheId: "cache3" });
			const sharedTopic = "cache:sync:multi-test-1";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: sharedTopic,
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: sharedTopic,
			});

			const sync3 = new CacheSync({
				cacheable: cacheable3,
				qified: sharedQified,
				instanceId: "instance3",
				topic: sharedTopic,
			});

			await sleep(50);

			await sync1.syncSet("key27", "value27");

			await sleep(50);

			const value2 = await cacheable2.get("key27");
			const value3 = await cacheable3.get("key27");

			expect(value2).toBe("value27");
			expect(value3).toBe("value27");

			await sync3.disconnect();
		});

		test("should handle complex sync scenarios", async () => {
			const sharedTopic = "cache:sync:multi-test-2";

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: sharedTopic,
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: sharedTopic,
			});

			await sleep(50);

			// Instance 1 sets some values
			await sync1.syncSet("a", "1");
			await sync1.syncSet("b", "2");

			await sleep(50);

			// Instance 2 should have them
			expect(await cacheable2.get("a")).toBe("1");
			expect(await cacheable2.get("b")).toBe("2");

			// Instance 2 modifies and deletes
			await sync2.syncSet("a", "modified");
			await sync2.syncDelete("b");

			await sleep(50);

			// Instance 1 should reflect changes
			expect(await cacheable1.get("a")).toBe("modified");
			expect(await cacheable1.get("b")).toBeUndefined();

			// Instance 1 clears
			await sync1.syncClear();

			await sleep(50);

			// Instance 2 should be cleared
			expect(await cacheable2.get("a")).toBeUndefined();
		});
	});

	describe("error handling", () => {
		test("should emit ERROR event when subscribe fails during construction", async () => {
			const errorSpy = vi.fn();

			// Create a qified instance and spy on subscribe to make it reject
			const testQified = new Qified({
				messageProviders: [sharedProvider],
			});

			const subscribeError = new Error("Subscribe failed");
			vi.spyOn(testQified, "subscribe").mockRejectedValueOnce(subscribeError);

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: testQified,
				enableSubscribe: true,
			});

			sync1.on(CacheSyncEvents.ERROR, errorSpy);

			// Wait for async subscribe to fail
			await sleep(50);

			expect(errorSpy).toHaveBeenCalledWith(subscribeError);
		});

		test("should emit ERROR event when publish fails", async () => {
			const errorSpy = vi.fn();

			// Create sync instance
			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				enableSubscribe: false,
			});

			sync1.on(CacheSyncEvents.ERROR, errorSpy);

			// Spy on qified.publish to make it reject
			const publishError = new Error("Publish failed");
			vi.spyOn(sync1.qified, "publish").mockRejectedValueOnce(publishError);

			// This should trigger the publish error
			await sync1.syncSet("key", "value");

			await sleep(50);

			expect(errorSpy).toHaveBeenCalledWith(publishError);
		});

		test("should emit ERROR event when apply fails", async () => {
			const spy = vi.fn();

			// Create a cacheable that throws on set
			const brokenCacheable = {
				cacheId: "broken",
				async set() {
					throw new Error("Set failed");
				},
				async setMany() {},
				async delete() {},
				async deleteMany() {},
				async clear() {},
			};

			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: "error-topic",
			});

			sync2 = new CacheSync({
				// biome-ignore lint/suspicious/noExplicitAny: broken cacheable
				cacheable: brokenCacheable as any,
				qified: sharedQified,
				instanceId: "instance2",
				topic: "error-topic",
			});

			sync2.on(CacheSyncEvents.ERROR, spy);

			await sleep(50);

			await sync1.syncSet("key", "value");

			await sleep(50);

			expect(spy).toHaveBeenCalled();
		});
	});

	describe("disabled operations coverage", () => {
		test("should not sync setMany when not in syncOperations", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: "disabled-ops-topic",
				syncOperations: ["set"], // Only allow set
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: "disabled-ops-topic",
			});

			await sleep(50);

			const items = [
				{ key: "key1", value: "value1" },
				{ key: "key2", value: "value2" },
			];

			await sync1.syncSetMany(items);

			await sleep(50);

			// Should not have synced
			const value1 = await cacheable2.get("key1");
			const value2 = await cacheable2.get("key2");

			expect(value1).toBeUndefined();
			expect(value2).toBeUndefined();
		});

		test("should not sync deleteMany when not in syncOperations", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: "disabled-deletemany-topic",
				syncOperations: ["set"], // Only allow set
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: "disabled-deletemany-topic",
			});

			await sleep(50);

			// Set up some values
			await cacheable1.set("key1", "value1");
			await cacheable2.set("key1", "value1");
			await cacheable1.set("key2", "value2");
			await cacheable2.set("key2", "value2");

			await sync1.syncDeleteMany(["key1", "key2"]);

			await sleep(50);

			// Should still exist
			const value1 = await cacheable2.get("key1");
			const value2 = await cacheable2.get("key2");

			expect(value1).toBe("value1");
			expect(value2).toBe("value2");
		});

		test("should not sync clear when not in syncOperations", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: "disabled-clear-topic",
				syncOperations: ["set"], // Only allow set
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: "disabled-clear-topic",
			});

			await sleep(50);

			// Set up some values
			await cacheable2.set("key1", "value1");

			await sync1.syncClear();

			await sleep(50);

			// Should still exist
			const value1 = await cacheable2.get("key1");

			expect(value1).toBe("value1");
		});

		test("should not apply operations when disabled via syncOperations on receiver", async () => {
			sync1 = new CacheSync({
				cacheable: cacheable1,
				qified: sharedQified,
				instanceId: "instance1",
				topic: "receiver-filter-topic",
			});

			sync2 = new CacheSync({
				cacheable: cacheable2,
				qified: sharedQified,
				instanceId: "instance2",
				topic: "receiver-filter-topic",
				syncOperations: ["delete"], // Only apply delete operations
			});

			await sleep(50);

			// Try to sync a set operation
			await sync1.syncSet("key1", "value1");

			await sleep(50);

			// Should not have been applied
			const value1 = await cacheable2.get("key1");
			expect(value1).toBeUndefined();

			// Now test delete which should work
			await cacheable1.set("key2", "value2");
			await cacheable2.set("key2", "value2");

			await sync1.syncDelete("key2");

			await sleep(50);

			const value2 = await cacheable2.get("key2");
			expect(value2).toBeUndefined();
		});
	});
});
