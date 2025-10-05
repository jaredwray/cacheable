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
});
