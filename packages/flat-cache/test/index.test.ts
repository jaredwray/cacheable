import {describe, test, expect} from 'vitest';
import {FlatCache} from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('flat-cache', () => {
	test('should initialize', () => {
		const cache = new FlatCache();
		expect(cache.cache).toBeDefined();
	});
	test('should get all keys', () => {
		const cache = new FlatCache();
		expect(cache.keys()).toBeDefined();
		expect(cache.all()).toBeDefined();
	});
	test('should set legacy key', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		expect(cache.all().foo).toBe('bar');
	});
	test('should set a key with a ttl', async () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar', 10);
		await sleep(20);
		expect(cache.getKey('foo')).toBe(undefined);
	});
	test('should get a key', () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar');
		expect(cache.get<string>('foo')).toBe('bar');
	});
	test('should remove key', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		cache.removeKey('foo');
		expect(cache.getKey('foo')).toBeUndefined();
	});
	test('should delete key', () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar');
		cache.delete('foo');
		expect(cache.get('foo')).toBeUndefined();
	});
	test('should set options', () => {
		const options = {
			ttl: 1000,
			useClones: true,
			lruSize: 1000,
			expirationInterval: 0,
			persistInterval: 6000,
			cacheDir: '.cachefoo',
		};
		const cache = new FlatCache(options);
		expect(cache.cacheDir).toBe('.cachefoo');
		cache.cacheDir = '.cachebar';
		expect(cache.cacheDir).toBe('.cachebar');
		expect(cache.persistInterval).toBe(6000);
		cache.persistInterval = 5000;
		expect(cache.persistInterval).toBe(5000);
	});
	test('should get all items', () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar');
		cache.set('bar', 'baz');
		cache.set('baz', 'foo');
		expect(cache.items.length).toBe(3);
		expect(cache.items[0].value).toEqual('bar');
		expect(cache.items[1].value).toEqual('foo');
		expect(cache.items[2].value).toEqual('baz');
	});
});
