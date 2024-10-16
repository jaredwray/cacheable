import {describe, expect, test} from 'vitest';
import {Keyv} from 'keyv';
import KeyvRedis from '@keyv/redis';
import {CacheableMemory, KeyvCacheableMemory} from 'cacheable';
import {createCache} from '../src/index.js';

describe('examples of cache-manager', async () => {
	test('set and get with multiple stores', async () => {
		// Multiple stores
		const cache = createCache({
			stores: [
				//  High performance in-memory cache with LRU and TTL
				new Keyv({
					store: new CacheableMemory({ttl: 60_000, lruSize: 5000}),
				}),

				//  Redis Store
				new Keyv({
					store: new KeyvRedis('redis://localhost:6379'),
				}),
			],
		});
		await cache.set('foo', 'bar');
		const value = await cache.get('foo');
		expect(value).toBe('bar');
	});
	test('set and get with KeyvCacheableMemory', async () => {
		const cache = createCache({
			stores: [
				//  High performance in-memory cache with LRU and TTL
				new Keyv({
					store: new KeyvCacheableMemory({ttl: 60_000, lruSize: 5000}),
				}),

				//  Redis Store
				new Keyv({
					store: new KeyvRedis('redis://localhost:6379'),
				}),
			],
		});
		await cache.set('foo', 'bar');
		const value = await cache.get('foo');
		expect(value).toBe('bar');
	});
});
