import {describe, test, expect} from 'vitest';
import NodeCache from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cache = new NodeCache({checkperiod: 0});

describe('NodeCache', () => {
	test('should create a new instance of NodeCache', () => {
		const cache = new NodeCache({checkperiod: 0});
		expect(cache).toBeInstanceOf(NodeCache);
	});

	test('should create a new instance of NodeCache with options', () => {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const cache = new NodeCache({stdTTL: 10, checkperiod: 0});
		expect(cache).toBeInstanceOf(NodeCache);
		expect(cache.options.stdTTL).toBe(10);
	});

	test('should set and get a key', () => {
		cache.on('set', (key, value) => {
			expect(key).toBe('foo');
			expect(value).toBe('bar');
		});
		cache.set('foo', 'bar');
		expect(cache.get('foo')).toBe('bar');
	});

	test('should set and get a key with ttl', async () => {
		const cache = new NodeCache({checkperiod: 0});
		cache.set('foo', 'bar', 0.5);
		cache.set('baz', 'qux');
		await sleep(600);
		expect(cache.get('foo')).toBe(undefined);
		expect(cache.get('baz')).toBe('qux');
	});

	test('should set multiple cache items', () => {
		const cache = new NodeCache({checkperiod: 0});
		const list = [
			{key: 'foo', value: 'bar'},
			{key: 'baz', value: 'qux'},
		];
		cache.mset(list);
		expect(cache.get('foo')).toBe('bar');
		expect(cache.get('baz')).toBe('qux');
	});

	test('should get multiple cache items', () => {
		const cache = new NodeCache({checkperiod: 0});
		cache.set('foo', 'bar');
		cache.set('baz', 'qux');
		const list = cache.mget(['foo', 'baz']);
		expect(list.foo).toBe('bar');
		expect(list.baz).toBe('qux');
	});

	test('should take a key', () => {
		cache.set('foo', 'bar');
		const value = cache.take('foo') as string;
		expect(value).toBe('bar');
		expect(cache.get('foo')).toBe(undefined);
	});

	test('should take a key and be undefined', () => {
		expect(cache.take('foo')).toBe(undefined);
	});

	test('should delete a key', () => {
		cache.set('foo', 'bar');
		cache.del('foo');
		expect(cache.get('foo')).toBe(undefined);
	});

	test('should delete multiple keys', () => {
		const cache = new NodeCache({checkperiod: 0});
		const list = [
			{key: 'foo', value: 'bar'},
			{key: 'baz', value: 'qux'},
		];
		cache.mset(list);
		cache.set('foo', 'bar');
		cache.set('baz', 'qux');
		cache.mdel(['foo', 'baz']);
		expect(cache.get('foo')).toBe(undefined);
		expect(cache.get('baz')).toBe(undefined);
	});

	test('should get the ttl / expiration of a key', () => {
		const cache = new NodeCache({checkperiod: 0});
		cache.set('foo', 'bar', 10);
		const firstTtl = cache.getTTL('foo')!;
		expect(firstTtl).toBeDefined();
		cache.ttl('foo', 15);
		const secondTtl = cache.getTTL('foo');
		expect(firstTtl).toBeLessThan(secondTtl!);
	});

	test('should return 0 if there is no key to delete', () => {
		const cache = new NodeCache({checkperiod: 0});
		const count = cache.del('foo');
		expect(count).toBe(0);
	});

	test('should return the correct count on mdel()', () => {
		const cache = new NodeCache({checkperiod: 0});
		const list = [
			{key: 'foo', value: 'bar'},
			{key: 'baz', value: 'qux'},
		];
		cache.mset(list);
		const count = cache.mdel(['foo', 'baz', 'qux']);
		expect(count).toBe(2);
	});

	test('it should return a 0 if there is no ttl set', () => {
		const cache = new NodeCache({checkperiod: 0});
		cache.set('foo', 'bar');
		const ttl = cache.getTTL('foo');
		expect(ttl).toBe(0);
	});

	test('should return false if there is no key on ttl()', () => {
		const cache = new NodeCache({checkperiod: 0});
		const ttl = cache.ttl('foo', 10);
		expect(ttl).toBe(false);
	});

	test('should return an array of keys', () => {
		const cache = new NodeCache({checkperiod: 0});
		cache.set('foo', 'bar');
		cache.set('baz', 'qux');
		const keys = cache.keys();
		expect(keys).toEqual(['foo', 'baz']);
	});

	test('should return true or false on has depending on if the key exists', () => {
		const cache = new NodeCache({checkperiod: 0});
		expect(cache.has('foo')).toBe(false);
		cache.set('foo', 'bar');
		const has = cache.has('foo');
		expect(has).toBe(true);
	});

	test('should return the stats of the cache', () => {
		const cache = new NodeCache({checkperiod: 0});
		cache.set('foo', 'bar');
		const stats = cache.getStats();
		expect(stats.keys).toBe(1);
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(0);
		cache.set('new', 'value');
		cache.get('new');
		cache.get('foo');
		cache.get('foo2');
		const newStats = cache.getStats();
		expect(newStats.keys).toBe(2);
		expect(newStats.hits).toBe(2);
		expect(newStats.misses).toBe(1);
		expect(newStats.vsize).toBeGreaterThan(0);
		expect(newStats.ksize).toBeGreaterThan(0);
		cache.flushStats();
		expect(cache.getStats().keys).toBe(0);
	});

	test('should flush all the keys', () => {
		const cache = new NodeCache({checkperiod: 0});
		cache.set('foo', 'bar');
		cache.set('baz', 'qux');
		cache.flushAll();
		expect(cache.keys()).toEqual([]);
	});

	test('should throw an error on maxKeys', () => {
		const cache = new NodeCache({checkperiod: 0, maxKeys: 1});
		cache.set('foo', 'bar');
		expect(() => cache.set('baz', 'qux')).toThrowError('Cache max keys amount exceeded');
	});

	test('should be able to get when an ttl is 0', async () => {
		const cache = new NodeCache({checkperiod: 0, useClones: false});
		cache.set('foo', 'bar', 100);
		cache.set('baz', 'qux', 0);
		cache.set('moo', 'moo', 0.5);
		console.log(cache.store.get('foo'));
		expect(cache.get('foo')).toBe('bar');
		expect(cache.get('baz')).toBe('qux');
		await sleep(600);
		expect(cache.get('moo')).toBe(undefined);
	});
});
