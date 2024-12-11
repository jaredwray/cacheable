import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {createCache} from '../src/index.js';
import {sleep} from './sleep.js';

describe('get', () => {
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
		await cache.set(data.key, data.value);
		await expect(cache.ttl(data.key)).resolves.toEqual(null);
	});

	it('expired', async () => {
		await cache.set(data.key, data.value, ttl);
		await sleep(ttl + 100);
		await expect(cache.ttl(data.key)).resolves.toEqual(null);
	});

	it('error', async () => {
		await cache.set(data.key, data.value);
		keyv.get = () => {
			throw new Error('get error');
		};

		await expect(cache.ttl(data.key)).resolves.toEqual(null);
	});
	it('error on non-blocking enabled', async () => {
		const secondKeyv = new Keyv();
		keyv.get = () => {
			throw new Error('get error');
		};

		const cache = createCache({stores: [keyv, secondKeyv], nonBlocking: true});
		await cache.set(data.key, data.value);
		await expect(cache.ttl(data.key)).resolves.toEqual(null);
	});
	it('gets the expiration of a key', async () => {
		await cache.set(data.key, data.value, ttl);
		const expiration = Date.now() + ttl;
		await expect(cache.ttl(data.key)).resolves.toBeGreaterThanOrEqual(expiration - 100);
	});

	it('gets the expiration of a key with nonBlocking', async () => {
		const secondKeyv = new Keyv();
		const cache = createCache({stores: [keyv, secondKeyv], nonBlocking: true});
		await cache.set(data.key, data.value, ttl);
		const expiration = Date.now() + ttl;
		await expect(cache.ttl(data.key)).resolves.toBeGreaterThanOrEqual(expiration - 100);
	});

	it('gets null of a key with nonBlocking', async () => {
		const secondKeyv = new Keyv();
		const cache = createCache({stores: [keyv, secondKeyv], nonBlocking: true});
		await expect(cache.ttl('non-block-bad-key1')).resolves.toEqual(null);
	});
});
