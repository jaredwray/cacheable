import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it, vi,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {createCache} from '../src/index.js';
import {sleep} from './sleep.js';

describe('wrap', () => {
	let keyv: Keyv;
	let cache: ReturnType<typeof createCache>;
	let ttl = 500;
	const data = {key: '', value: ''};

	beforeEach(async () => {
		data.key = faker.string.alpha(20);
		data.value = faker.string.sample();
		ttl = faker.number.int({min: 500, max: 1000});
		keyv = new Keyv();
		cache = createCache({stores: [keyv]});
	});

	it('basic', async () => {
		const getValue = vi.fn(() => data.value);
		await cache.wrap(data.key, getValue);
		await cache.wrap(data.key, getValue);
		expect(getValue).toBeCalledTimes(1);
	});

	it('ttl - milliseconds', async () => {
		await cache.wrap(data.key, async () => data.value, ttl);
		await expect(cache.get(data.key)).resolves.toEqual(data.value);
		await sleep(ttl + 100);
		await expect(cache.get(data.key)).resolves.toBeNull();
	});

	it('ttl - function', async () => {
		const getTtlFunction = vi.fn(() => ttl);
		await cache.wrap(data.key, async () => data.value, getTtlFunction);
		await expect(cache.get(data.key)).resolves.toEqual(data.value);
		await sleep(ttl + 100);
		await expect(cache.get(data.key)).resolves.toBeNull();
		expect(getTtlFunction).toHaveBeenCalledTimes(1);
	});

	it('calls fn once to fetch value on cache miss when invoked multiple times', async () => {
		const getValue = vi.fn().mockResolvedValue(data.value);

		// Confirm the cache is empty.
		await expect(cache.get(data.key)).resolves.toBeNull();

		// Simulate several concurrent requests for the same value.
		const array = Array.from({length: 10}).fill(null);
		const results = await Promise.allSettled(array.map(async () => cache.wrap(data.key, getValue, ttl)));

		// Assert that the function was called exactly once.
		expect(getValue).toHaveBeenCalledTimes(1);

		// Assert that all requests resolved to the same value.
		for (const result of results) {
			expect(result).toMatchObject({
				status: 'fulfilled',
				value: data.value,
			});
		}
	});

	it('should allow dynamic refreshThreshold on wrap function', async () => {
		const config = {ttl: 2000, refreshThreshold: 1000};

		// 1st call should be cached
		expect(await cache.wrap(data.key, async () => 0, config.ttl, config.refreshThreshold)).toEqual(0);
		await sleep(1001);
		// Background refresh, but stale value returned
		expect(await cache.wrap(data.key, async () => 1, config.ttl, config.refreshThreshold)).toEqual(0);
		// New value in cache
		expect(await cache.wrap(data.key, async () => 2, config.ttl, config.refreshThreshold)).toEqual(1);

		await sleep(1001);
		// No background refresh with the new override params
		expect(await cache.wrap(data.key, async () => 3, undefined, 500)).toEqual(1);
		await sleep(500);
		// Background refresh, but stale value returned
		expect(await cache.wrap(data.key, async () => 4, undefined, 500)).toEqual(1);
		expect(await cache.wrap(data.key, async () => 5, undefined, 500)).toEqual(4);
	});

	it('store get failed', async () => {
		const getValue = vi.fn(() => data.value);
		keyv.get = () => {
			throw new Error('get failed');
		};

		const refreshThreshold = ttl / 2;
		await expect(cache.wrap(data.key, getValue, ttl, refreshThreshold)).resolves.toEqual(data.value);
		await expect(cache.wrap(data.key, getValue, ttl, refreshThreshold)).resolves.toEqual(data.value);
		expect(getValue).toBeCalledTimes(2);
	});
});

describe('wrap with multi-layer stores', () => {
	let keyv1: Keyv;
	let keyv2: Keyv;
	let cache: ReturnType<typeof createCache>;
	const ttl1 = 800;
	const ttl2 = 2000;
	const refreshThreshold = 500;
	const data = {key: '', value: ''};

	beforeEach(async () => {
		data.key = faker.string.alpha(20);
		data.value = faker.string.sample();
		keyv1 = new Keyv({ttl: ttl1});
		keyv2 = new Keyv({ttl: ttl2});
		cache = createCache({refreshThreshold, stores: [keyv1, keyv2]});
	});

	it('should refresh according to refreshThreshold', async () => {
		// 1st call should be cached
		expect(await cache.wrap(data.key, async () => 0)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(0);
		expect(await keyv2.get(data.key)).toEqual(0);

		// Sleep 501ms, trigger keyv1 refresh
		await sleep(501);

		// Background refresh, but stale value returned, while keyv1 is already updated
		expect(await cache.wrap(data.key, async () => 1)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(0);

		// New value returned
		expect(await cache.wrap(data.key, async () => 2)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(0);

		// Sleep 1001ms, keyv1 expired, trigger keyv2 refresh
		await sleep(1001);

		expect(await keyv1.get(data.key)).toBeUndefined();
		expect(await keyv2.get(data.key)).toEqual(0);

		// Background refresh, but stale value returned, while keyv1 is already updated
		expect(await cache.wrap(data.key, async () => 3)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(3);
		expect(await keyv2.get(data.key)).toEqual(3);

		// New value returned
		expect(await cache.wrap(data.key, async () => 4)).toEqual(3);
		expect(await keyv1.get(data.key)).toEqual(3);
		expect(await keyv2.get(data.key)).toEqual(3);
	});

	it('should respect refreshAllStores', async () => {
		cache = createCache({refreshThreshold, refreshAllStores: true, stores: [keyv1, keyv2]});

		// 1st call should be cached
		expect(await cache.wrap(data.key, async () => 0)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(0);
		expect(await keyv2.get(data.key)).toEqual(0);

		// Sleep 501ms, trigger keyv1 refresh
		await sleep(550);

		// Background refresh, but stale value returned, while keyv1 and keyv2 are all updated
		expect(await cache.wrap(data.key, async () => 1)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(1);

		// New value returned
		expect(await cache.wrap(data.key, async () => 2)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(1);

		// Sleep 1001ms, keyv1 expired, but keyv2 was refreshed before, so keyv2 will not be refreshed, write back to keyv1 directly
		await sleep(1050);

		expect(await keyv1.get(data.key)).toBeUndefined();
		expect(await keyv2.get(data.key)).toEqual(1);

		// No background refresh, write keyv2 value back to keyv1
		expect(await cache.wrap(data.key, async () => 3)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(1);

		// Sleep 850ms, keyv1 expired, trigger keyv2 refresh
		await sleep(850);

		expect(await keyv1.get(data.key)).toBeUndefined();
		expect(await keyv2.get(data.key)).toEqual(1);

		// Background refresh, but stale value returned, while keyv1 and keyv2 are all updated
		expect(await cache.wrap(data.key, async () => 4)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(4);
		expect(await keyv2.get(data.key)).toEqual(4);

		// New value returned
		expect(await cache.wrap(data.key, async () => 5)).toEqual(4);
		expect(await keyv1.get(data.key)).toEqual(4);
		expect(await keyv2.get(data.key)).toEqual(4);
	});
});
