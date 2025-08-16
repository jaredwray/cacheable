// biome-ignore-all lint/suspicious/noExplicitAny: test file
import { faker } from "@faker-js/faker";
import { redisStore as redisYetStore } from "cache-manager-redis-yet";
import { Keyv } from "keyv";
import { describe, expect, it, vi } from "vitest";
import {
	type CacheManagerStore,
	createCache,
	KeyvAdapter,
} from "../src/index.js";

const mockCacheManagerStore: CacheManagerStore = {
	name: "MockCacheManagerStore",
	isCacheable: vi.fn((value: unknown) => value !== undefined),
	get: vi.fn(async (key: string) => `Value for ${key}`),
	mget: vi.fn(async (...keys: string[]) =>
		keys.map((key) => `Value for ${key}`),
	),
	set: vi.fn(
		async (key: string, value: any, ttl?: number) =>
			`Set ${key} to ${value} with TTL ${ttl}`,
	),
	mset: vi.fn(async () => undefined),
	del: vi.fn(async () => undefined),
	mdel: vi.fn(async () => undefined),
	ttl: vi.fn(async () => 0),
	keys: vi.fn(async () => ["key1", "key2", "key3"]),
	reset: vi.fn(async () => undefined),
	on: vi.fn((event: string) => {
		console.log(`Event ${event} registered.`);
	}),
	disconnect: vi.fn(async () => undefined),
};

describe("keyv-adapter", async () => {
	it("able to handle redis yet third party conversion", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const cache = createCache({ stores: [keyv] });
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await cache.set(key, value);
		const result = await cache.get(key);
		expect(result).toEqual(value);
	});

	it("returns undefined on get", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const cache = createCache({ stores: [keyv] });
		const result = await cache.get("key");
		expect(result).toBeUndefined();
	});

	it("deletes a key", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const cache = createCache({ stores: [keyv] });
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await cache.set(key, value);
		const result = await cache.get(key);
		expect(result).toEqual(value);
		await cache.del(key);
		const result2 = await cache.get(key);
		expect(result2).toBeUndefined();
	});

	it("clears the cache", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const cache = createCache({ stores: [keyv] });
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await cache.set(key, value);
		const result = await cache.get(key);
		expect(result).toEqual(value);
		await cache.clear();
		const result2 = await cache.get(key);
		expect(result2).toBeUndefined();
	});

	it("returns false on has", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const result = await keyv.has("key");
		expect(result).toEqual(false);
	});

	it("returns true on has", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await keyv.set(key, value);
		const result = await keyv.has(key);
		expect(result).toEqual(true);
	});

	it("gets many keys", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const cache = createCache({ stores: [keyv] });
		const list = [
			{ key: faker.string.alpha(20), value: faker.string.sample() },
			{ key: faker.string.alpha(20), value: faker.string.sample() },
		];

		await cache.mset(list);
		const keyvResult = await keyv.get(list.map(({ key }) => key));
		expect(keyvResult).toEqual(list.map(({ value }) => value));
		const result = await cache.mget(list.map(({ key }) => key));
		expect(result).toEqual([list[0].value, list[1].value]);
	});

	it("should delete many keys", async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({ store: adapter });
		const list = [
			{ key: faker.string.alpha(20), value: faker.string.sample() },
			{ key: faker.string.alpha(20), value: faker.string.sample() },
		];

		await keyv.set(list[0].key, list[0].value);
		await keyv.set(list[1].key, list[1].value);
		await keyv.delete(list.map(({ key }) => key));
		const result = await keyv.get(list.map(({ key }) => key));
		expect(result).toEqual([undefined, undefined]);
	});

	it("should disconnect", async () => {
		// Store without disconnect
		const storeNoDisconnect = await redisYetStore();
		const adapterNoDisconnect = new KeyvAdapter(storeNoDisconnect);
		const keyvNoDisconnect = new Keyv({ store: adapterNoDisconnect });

		await keyvNoDisconnect.disconnect();

		// Store with disconnect
		const adapterWithDisconnect = new KeyvAdapter(mockCacheManagerStore);
		const keyvWithDisconnect = new Keyv({ store: adapterWithDisconnect });

		await keyvWithDisconnect.disconnect();
		expect(mockCacheManagerStore.disconnect).toBeCalled();
	});
});
