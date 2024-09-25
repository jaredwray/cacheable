import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it,
} from 'vitest';
import {faker} from '@faker-js/faker';
import {createCache} from '../src/index.js';
import {sleep} from './sleep.js';

describe('mdel', () => {
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
		await expect(cache.get(list[0].key)).resolves.toEqual(list[0].value);
		await expect(cache.get(list[1].key)).resolves.toEqual(list[1].value);
		await expect(cache.get(list[2].key)).resolves.toEqual(list[2].value);
		await cache.mdel([list[0].key, list[1].key]);
		await expect(cache.get(list[0].key)).resolves.toEqual(null);
		await expect(cache.get(list[1].key)).resolves.toEqual(null);
		await expect(cache.get(list[2].key)).resolves.toEqual(list[2].value);
	});
	it('should be non-blocking', async () => {
		const secondKeyv = new Keyv();
		const cache = createCache({stores: [keyv, secondKeyv], nonBlocking: true});
		await cache.mset(list);
		await cache.mdel(list.map(({key}) => key));
		await sleep(200);
		await expect(cache.get(list[0].key)).resolves.toBeNull();
		await expect(cache.get(list[1].key)).resolves.toBeNull();
		await expect(cache.get(list[2].key)).resolves.toBeNull();
	});
});
