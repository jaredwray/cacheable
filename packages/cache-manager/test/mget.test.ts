import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {createCache} from '../src/index.js';

describe('mget', () => {
	let keyv: Keyv;
	let cache: ReturnType<typeof createCache>;
	let ttl = 500;
	let list = [] as Array<{key: string; value: string}>;

	beforeEach(async () => {
		ttl = faker.number.int({min: 500, max: 1000});
		keyv = new Keyv();
		cache = createCache({stores: [keyv]});
		list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];
	});

	it('basic', async () => {
		await cache.mset(list);
		const keys = list.map(item => item.key);
		const values = list.map(item => item.value);
		await expect(cache.mget(keys)).resolves.toEqual(values);
	});
});
