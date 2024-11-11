import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {createCache} from '../src/index.js';
import {sleep} from './sleep.js';

describe('mset', () => {
	let keyv: Keyv;
	let cache: ReturnType<typeof createCache>;
	let ttl = 500;

	beforeEach(async () => {
		ttl = faker.number.int({min: 500, max: 1000});
		keyv = new Keyv();
		cache = createCache({stores: [keyv]});
	});

	it('basic', async () => {
		const list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];

		await expect(cache.mset(list)).resolves.toEqual(list);
		await expect(cache.get(list[0].key)).resolves.toEqual(list[0].value);
	});

	it('should mset non-blocking', async () => {
		const secondKeyv = new Keyv();
		const cache = createCache({stores: [keyv, secondKeyv], nonBlocking: true});
		const list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];

		await cache.mset(list);
		await sleep(10);
		await expect(cache.get(list[0].key)).resolves.toEqual(list[0].value);
	});
});
