import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {redisStore as redisYetStore} from 'cache-manager-redis-yet';
import {createCache, KeyvAdapter} from '../src/index.js';

describe('keyv-adapter', async () => {
	it('able to handle redis yet third party conversion', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const cache = createCache({stores: [keyv]});
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await cache.set(key, value);
		const result = await cache.get(key);
		expect(result).toEqual(value);
	});

	it('returns undefined on get', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const cache = createCache({stores: [keyv]});
		const result = await cache.get('key');
		expect(result).toEqual(null);
	});

	it('deletes a key', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const cache = createCache({stores: [keyv]});
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await cache.set(key, value);
		const result = await cache.get(key);
		expect(result).toEqual(value);
		await cache.del(key);
		const result2 = await cache.get(key);
		expect(result2).toEqual(null);
	});

	it('clears the cache', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const cache = createCache({stores: [keyv]});
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await cache.set(key, value);
		const result = await cache.get(key);
		expect(result).toEqual(value);
		await cache.clear();
		const result2 = await cache.get(key);
		expect(result2).toEqual(null);
	});

	it('returns false on has', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const result = await keyv.has('key');
		expect(result).toEqual(false);
	});

	it('returns true on has', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const key = faker.string.alpha(20);
		const value = faker.string.sample();
		await keyv.set(key, value);
		const result = await keyv.has(key);
		expect(result).toEqual(true);
	});

	it('gets many keys', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const cache = createCache({stores: [keyv]});
		const list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];

		await cache.mset(list);
		const keyvResult = await keyv.get(list.map(({key}) => key));
		expect(keyvResult).toEqual(list.map(({value}) => value));
		const result = await cache.mget(list.map(({key}) => key));
		expect(result).toEqual([list[0].value, list[1].value]);
	});

	it('should delete many keys', async () => {
		const store = await redisYetStore();
		const adapter = new KeyvAdapter(store);
		const keyv = new Keyv({store: adapter});
		const list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];

		await keyv.set(list[0].key, list[0].value);
		await keyv.set(list[1].key, list[1].value);
		await keyv.delete(list.map(({key}) => key));
		const result = await keyv.get(list.map(({key}) => key));
		expect(result).toEqual([undefined, undefined]);
	});
});

