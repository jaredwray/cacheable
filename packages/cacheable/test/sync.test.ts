import { MemoryMessageProvider, type Message, Qified } from "qified";
import { describe, expect, test } from "vitest";
import { CacheableSync, CacheableSyncEvents } from "../src/sync.js";

describe("CacheableSync", () => {
	test("should instantiate with Qified instance", () => {
		const qified = new Qified();
		const sync = new CacheableSync({ qified });
		expect(sync).toBeDefined();
	});

	test("should instantiate with single MessageProvider", () => {
		const provider = new MemoryMessageProvider();
		const sync = new CacheableSync({ qified: provider });
		expect(sync).toBeDefined();
	});

	test("should instantiate with array of MessageProviders", () => {
		const provider1 = new MemoryMessageProvider({ id: "provider1" });
		const provider2 = new MemoryMessageProvider({ id: "provider2" });
		const sync = new CacheableSync({ qified: [provider1, provider2] });
		expect(sync).toBeDefined();
	});

	describe("qified getter/setter", () => {
		test("should get qified instance", () => {
			const qified = new Qified();
			const sync = new CacheableSync({ qified });
			expect(sync.qified).toBe(qified);
		});

		test("should set qified with Qified instance", () => {
			const qified1 = new Qified();
			const qified2 = new Qified();
			const sync = new CacheableSync({ qified: qified1 });
			sync.qified = qified2;
			expect(sync.qified).toBe(qified2);
		});

		test("should set qified with MessageProvider", () => {
			const provider1 = new MemoryMessageProvider({ id: "provider1" });
			const provider2 = new MemoryMessageProvider({ id: "provider2" });
			const sync = new CacheableSync({ qified: provider1 });
			sync.qified = provider2;
			expect(sync.qified.messageProviders).toHaveLength(1);
			expect(sync.qified.messageProviders[0].id).toBe("provider2");
		});
	});

	describe("createQified", () => {
		test("should return existing Qified instance", () => {
			const qified = new Qified();
			const sync = new CacheableSync({ qified });
			const result = sync.createQified(qified);
			expect(result).toBe(qified);
		});

		test("should create Qified from single MessageProvider", () => {
			const provider = new MemoryMessageProvider({ id: "test-provider" });
			const sync = new CacheableSync({ qified: provider });
			const result = sync.createQified(provider);
			expect(result).toBeInstanceOf(Qified);
			expect(result.messageProviders).toHaveLength(1);
			expect(result.messageProviders[0].id).toBe("test-provider");
		});

		test("should create Qified from array of MessageProviders", () => {
			const provider1 = new MemoryMessageProvider({ id: "provider1" });
			const provider2 = new MemoryMessageProvider({ id: "provider2" });
			const sync = new CacheableSync({ qified: [provider1, provider2] });
			const result = sync.createQified([provider1, provider2]);
			expect(result).toBeInstanceOf(Qified);
			expect(result.messageProviders).toHaveLength(2);
			expect(result.messageProviders[0].id).toBe("provider1");
			expect(result.messageProviders[1].id).toBe("provider2");
		});
	});

	describe("publish", () => {
		test("should publish cache set event", async () => {
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({ qified: provider });

			let receivedMessage: Message | undefined;
			await sync.qified.subscribe(CacheableSyncEvents.SET, {
				handler: async (message) => {
					receivedMessage = message;
				},
			});

			await sync.publish(CacheableSyncEvents.SET, {
				cacheId: "cache1",
				key: "testKey",
				value: "testValue",
				ttl: 1000,
			});

			expect(receivedMessage).toBeDefined();
			expect(receivedMessage?.data.cacheId).toBe("cache1");
			expect(receivedMessage?.data.key).toBe("testKey");
			expect(receivedMessage?.data.value).toBe("testValue");
			expect(receivedMessage?.data.ttl).toBe(1000);
			expect(receivedMessage?.id).toBeDefined();
		});

		test("should publish cache delete event", async () => {
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({ qified: provider });

			let receivedMessage: Message | undefined;
			await sync.qified.subscribe(CacheableSyncEvents.DELETE, {
				handler: async (message) => {
					receivedMessage = message;
				},
			});

			await sync.publish(CacheableSyncEvents.DELETE, {
				cacheId: "cache1",
				key: "testKey",
			});

			expect(receivedMessage).toBeDefined();
			expect(receivedMessage?.data.cacheId).toBe("cache1");
			expect(receivedMessage?.data.key).toBe("testKey");
			expect(receivedMessage?.id).toBeDefined();
		});
	});

	describe("subscribe", () => {
		test("should subscribe to SET events and update storage", async () => {
			const { Keyv } = await import("keyv");
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({ qified: provider });
			const storage = new Keyv();

			sync.subscribe(storage, "cache1");

			// Wait for subscription to be ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			await sync.publish(CacheableSyncEvents.SET, {
				cacheId: "cache2",
				key: "testKey",
				value: "testValue",
				ttl: 1000,
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			const value = await storage.get("testKey");
			expect(value).toBe("testValue");
		});

		test("should not update storage for messages from same cacheId", async () => {
			const { Keyv } = await import("keyv");
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({ qified: provider });
			const storage = new Keyv();

			sync.subscribe(storage, "cache1");

			// Wait for subscription to be ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			await sync.publish(CacheableSyncEvents.SET, {
				cacheId: "cache1",
				key: "testKey",
				value: "testValue",
				ttl: 1000,
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			const value = await storage.get("testKey");
			expect(value).toBeUndefined();
		});

		test("should subscribe to DELETE events and update storage", async () => {
			const { Keyv } = await import("keyv");
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({ qified: provider });
			const storage = new Keyv();

			await storage.set("testKey", "testValue");
			sync.subscribe(storage, "cache1");

			// Wait for subscription to be ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			await sync.publish(CacheableSyncEvents.DELETE, {
				cacheId: "cache2",
				key: "testKey",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			const value = await storage.get("testKey");
			expect(value).toBeUndefined();
		});
	});

	describe("namespace", () => {
		test("should get and set namespace", () => {
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({
				qified: provider,
				namespace: "test-ns",
			});
			expect(sync.namespace).toBe("test-ns");

			sync.namespace = "new-ns";
			expect(sync.namespace).toBe("new-ns");
		});

		test("should accept function namespace", () => {
			const provider = new MemoryMessageProvider({ id: "test" });
			const namespaceFunc = () => "dynamic-ns";
			const sync = new CacheableSync({
				qified: provider,
				namespace: namespaceFunc,
			});
			expect(sync.namespace).toBe(namespaceFunc);
		});

		test("should publish with string namespace prefix", async () => {
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({
				qified: provider,
				namespace: "service1",
			});

			let receivedTopic: string | undefined;
			let receivedMessage: Message | undefined;

			// Subscribe to the namespaced event
			await sync.qified.subscribe("service1::cache:set", {
				handler: async (message) => {
					receivedTopic = "service1::cache:set";
					receivedMessage = message;
				},
			});

			await sync.publish(CacheableSyncEvents.SET, {
				cacheId: "cache1",
				key: "testKey",
				value: "testValue",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(receivedTopic).toBe("service1::cache:set");
			expect(receivedMessage).toBeDefined();
			expect(receivedMessage?.data.key).toBe("testKey");
		});

		test("should publish with function namespace prefix", async () => {
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({
				qified: provider,
				namespace: () => "dynamic-service",
			});

			let receivedTopic: string | undefined;
			let receivedMessage: Message | undefined;

			// Subscribe to the namespaced event
			await sync.qified.subscribe("dynamic-service::cache:set", {
				handler: async (message) => {
					receivedTopic = "dynamic-service::cache:set";
					receivedMessage = message;
				},
			});

			await sync.publish(CacheableSyncEvents.SET, {
				cacheId: "cache1",
				key: "testKey",
				value: "testValue",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(receivedTopic).toBe("dynamic-service::cache:set");
			expect(receivedMessage).toBeDefined();
		});

		test("should isolate services with different namespaces", async () => {
			const { Keyv } = await import("keyv");
			const provider = new MemoryMessageProvider({ id: "test" });

			const sync1 = new CacheableSync({
				qified: provider,
				namespace: "service1",
			});
			const storage1 = new Keyv();

			const sync2 = new CacheableSync({
				qified: provider,
				namespace: "service2",
			});
			const storage2 = new Keyv();

			sync1.subscribe(storage1, "cache1");
			sync2.subscribe(storage2, "cache2");

			// Wait for subscriptions to be ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Service1 publishes a message
			await sync1.publish(CacheableSyncEvents.SET, {
				cacheId: "cache1",
				key: "testKey",
				value: "service1Value",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Service2's storage should NOT be updated
			const value2 = await storage2.get("testKey");
			expect(value2).toBeUndefined();

			// Service2 publishes a message
			await sync2.publish(CacheableSyncEvents.SET, {
				cacheId: "cache2",
				key: "testKey",
				value: "service2Value",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Service1's storage should NOT be updated
			const value1 = await storage1.get("testKey");
			expect(value1).toBeUndefined();
		});

		test("should work without namespace (backward compatibility)", async () => {
			const { Keyv } = await import("keyv");
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({ qified: provider });
			const storage = new Keyv();

			sync.subscribe(storage, "cache1");

			// Wait for subscription to be ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			await sync.publish(CacheableSyncEvents.SET, {
				cacheId: "cache2",
				key: "testKey",
				value: "testValue",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			const value = await storage.get("testKey");
			expect(value).toBe("testValue");
		});

		test("should resubscribe when namespace changes", async () => {
			const { Keyv } = await import("keyv");
			const provider = new MemoryMessageProvider({ id: "test" });
			const sync = new CacheableSync({
				qified: provider,
				namespace: "service1",
			});
			const storage = new Keyv();

			sync.subscribe(storage, "cache1");

			// Wait for subscription to be ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Change namespace
			sync.namespace = "service2";

			// Wait for resubscription
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Publish with the new namespace
			await sync.publish(CacheableSyncEvents.SET, {
				cacheId: "cache2",
				key: "testKey",
				value: "testValue",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			const value = await storage.get("testKey");
			expect(value).toBe("testValue");
		});

		test("should not receive messages on old namespace after change", async () => {
			const { Keyv } = await import("keyv");
			const provider = new MemoryMessageProvider({ id: "test" });

			// Create two syncs with different namespaces
			const sync1 = new CacheableSync({
				qified: provider,
				namespace: "service1",
			});
			const storage1 = new Keyv();

			const sync2 = new CacheableSync({
				qified: provider,
				namespace: "service2",
			});
			const storage2 = new Keyv();

			sync1.subscribe(storage1, "cache1");
			sync2.subscribe(storage2, "cache2");

			// Wait for subscriptions to be ready
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Change sync1's namespace to match sync2
			sync1.namespace = "service2";

			// Wait for resubscription
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Now sync1 should receive messages from sync2's namespace
			await sync2.publish(CacheableSyncEvents.SET, {
				cacheId: "cache2",
				key: "testKey",
				value: "service2Value",
			});

			// Wait for message to be processed
			await new Promise((resolve) => setTimeout(resolve, 100));

			const value1 = await storage1.get("testKey");
			expect(value1).toBe("service2Value");
		});
	});
});
