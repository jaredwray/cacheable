/* eslint-disable @typescript-eslint/no-floating-promises, promise/prefer-await-to-then */
import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it, vi,
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

	it('should work blocking', async () => {
		let resolveDeleted: (value: boolean) => void = () => undefined;
		const deletePromise = new Promise<boolean>(_resolve => {
			resolveDeleted = _resolve;
		});
		const cache = createCache({stores: [keyv], nonBlocking: false});
		await cache.mset(list);

		const delHandler = vi.spyOn(keyv, 'delete').mockReturnValue(deletePromise);
		const deleteResolved = vi.fn();
		const deleteRejected = vi.fn();
		cache.mdel(list.map(({key}) => key)).catch(deleteRejected).then(deleteResolved);

		expect(delHandler).toBeCalledTimes(list.length);

		await sleep(200);

		expect(deleteResolved).not.toBeCalled();
		expect(deleteRejected).not.toBeCalled();

		resolveDeleted(true);
		await sleep(1);

		expect(deleteResolved).toBeCalled();
		expect(deleteRejected).not.toBeCalled();
	});

	it('should work non-blocking', async () => {
		const deletePromise = new Promise<boolean>(_resolve => {
			// Do nothing, this will be a never resolved promise
		});
		const cache = createCache({stores: [keyv], nonBlocking: true});
		await cache.mset(list);

		const delHandler = vi.spyOn(keyv, 'delete').mockReturnValue(deletePromise);
		const deleteResolved = vi.fn();
		const deleteRejected = vi.fn();
		cache.mdel(list.map(({key}) => key)).catch(deleteRejected).then(deleteResolved);

		expect(delHandler).toBeCalledTimes(list.length);

		await sleep(1);

		expect(deleteResolved).toBeCalled();
		expect(deleteRejected).not.toBeCalled();
	});
});
