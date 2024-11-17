import {
	describe, expect, test, vi,
} from 'vitest';
import {Keyv} from 'keyv';
import KeyvRedis from '@keyv/redis';
import {CacheableMemory} from 'cacheable';
import {createCache} from '../src/index.js';

describe('disconnect', () => {
	test('disconnect from multiple stores', async () => {
		const cacheableKeyvStore = new Keyv({
			store: new CacheableMemory({ttl: 60_000, lruSize: 5000}),
		});
		const redisKeyvStore = new Keyv({
			store: new KeyvRedis('redis://localhost:6379'),
		});
		// Multiple stores
		const cache = createCache({
			stores: [
				cacheableKeyvStore,
				redisKeyvStore,
			],
		});

		const cacheableDisconnectSpy = vi.spyOn(cacheableKeyvStore, 'disconnect');
		const redisDisconnectSpy = vi.spyOn(redisKeyvStore, 'disconnect');
		await cache.disconnect();

		expect(cacheableDisconnectSpy).toBeCalled();
		expect(redisDisconnectSpy).toBeCalled();
	});
	test('error', async () => {
		const keyv = new Keyv();
		const cache = createCache({
			stores: [
				keyv,
			],
		});
		const error = new Error('disconnect error');
		keyv.disconnect = () => {
			throw error;
		};

		await expect(cache.disconnect()).rejects.toThrowError(error);
	});
});
