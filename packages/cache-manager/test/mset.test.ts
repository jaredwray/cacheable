/* eslint-disable @typescript-eslint/no-floating-promises, promise/prefer-await-to-then */
import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it, vi,
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

	it('should work blocking', async () => {
		const list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];

		let resolveSetMany: (value: boolean[]) => void = () => undefined;
		const setManyPromise = new Promise<boolean[]>(_resolve => {
			resolveSetMany = _resolve;
		});

		const cache = createCache({stores: [keyv], nonBlocking: false});
		const setManyHandler = vi.spyOn(keyv, 'setMany').mockReturnValue(setManyPromise);
		const setResolved = vi.fn();
		const setRejected = vi.fn();
		cache.mset(list).catch(setRejected).then(setResolved);

		expect(setManyHandler).toHaveBeenCalledOnce();

		await sleep(200);

		expect(setResolved).not.toBeCalled();
		expect(setRejected).not.toBeCalled();

		resolveSetMany(list.map(() => true));
		await sleep(1);

		expect(setResolved).toBeCalled();
		expect(setRejected).not.toBeCalled();
	});

	it('should work non-blocking', async () => {
		const list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];

		const setManyPromise = new Promise<boolean[]>(_resolve => {
			// Do nothing, this will be a never resolved promise
		});

		const cache = createCache({stores: [keyv], nonBlocking: true});
		const setManyHandler = vi.spyOn(keyv, 'setMany').mockReturnValue(setManyPromise);
		const setResolved = vi.fn();
		const setRejected = vi.fn();
		cache.mset(list).catch(setRejected).then(setResolved);

		expect(setManyHandler).toHaveBeenCalledOnce();

		await sleep(1);

		expect(setResolved).toBeCalled();
		expect(setRejected).not.toBeCalled();
	});
});
