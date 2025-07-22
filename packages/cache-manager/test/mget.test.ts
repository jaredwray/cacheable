import {Keyv} from 'keyv';
import {
	beforeEach, describe, expect, it, vi,
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
		list = [
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
			{key: faker.string.alpha(20), value: faker.string.sample()},
		];
	});

	describe('blocking', () => {
		beforeEach(() => {
			cache = createCache({stores: [keyv], nonBlocking: false});
		});

		it('basic', async () => {
			await cache.mset(list);
			const keys = list.map(item => item.key);
			const values = list.map(item => item.value);
			await expect(cache.mget(keys)).resolves.toEqual(values);
		});

		it('error', async () => {
			keyv.getMany = () => {
				throw new Error('getMany error');
			};

			const mgetEventMock = vi.fn();
			cache.on('mget', mgetEventMock);
			const keys = list.map(item => item.key);
			await expect(cache.mget(keys)).resolves.toEqual(list.map(() => undefined));
			expect(mgetEventMock).toHaveBeenCalledWith({
				keys,
				error: expect.any(Error),
			});
		});

		it('calls getMany instead of get', async () => {
			const mgetSpy = vi.spyOn(keyv, 'getMany');
			const getSpy = vi.spyOn(keyv, 'get');
			await expect(cache.mget([])).resolves.toEqual([]);
			expect(mgetSpy).toHaveBeenCalled();
			expect(getSpy).not.toHaveBeenCalled();
		});
	});

	describe('non-blocking', () => {
		beforeEach(() => {
			cache = createCache({stores: [keyv], nonBlocking: true});
		});

		it('basic', async () => {
			await cache.mset(list);
			const keys = list.map(item => item.key);
			const values = list.map(item => item.value);
			await expect(cache.mget(keys)).resolves.toEqual(values);
		});

		it('error', async () => {
			keyv.getMany = () => {
				throw new Error('getMany error');
			};

			const mgetEventMock = vi.fn();
			cache.on('mget', mgetEventMock);
			const keys = list.map(item => item.key);
			await expect(cache.mget(keys)).resolves.toEqual(list.map(() => undefined));
			expect(mgetEventMock).toHaveBeenCalledWith({
				keys,
				error: expect.any(Error),
			});
		});
	});
});
