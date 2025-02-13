/* eslint-disable no-await-in-loop */
import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {createCache} from '../src/index.js';
import {sleep} from './sleep.js';

describe('clear', () => {
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
		const array = [1, 2, 3];
		for (const index of array) {
			await cache.set(data.key + index, data.value + index, ttl);
			await expect(cache.get(data.key + index)).resolves.toEqual(data.value + index);
		}

		await expect(cache.clear()).resolves.toEqual(true);
		for (const index of array) {
			await expect(cache.get(data.key + index)).resolves.toBeUndefined();
		}
	});

	it('clear should be non-blocking', async () => {
		const secondKeyv = new Keyv();
		const cache = createCache({stores: [keyv, secondKeyv], nonBlocking: true});
		await cache.set(data.key, data.value);
		expect(await secondKeyv.get(data.key)).toBe(data.value);
		await cache.clear();
		await sleep(200);
		await expect(cache.get(data.key)).resolves.toBeUndefined();
		await expect(secondKeyv.get(data.key)).resolves.toBeUndefined();
	});

	it('error', async () => {
		await cache.set(data.key, data.value);
		const error = new Error('clear error');
		keyv.clear = () => {
			throw error;
		};

		await expect(cache.clear()).rejects.toThrowError(error);
	});
});
