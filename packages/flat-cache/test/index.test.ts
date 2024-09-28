import fs from 'node:fs';
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
	test('should set a key with a ttl', async () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar', 10);
		await sleep(20);
		expect(cache.getKey('foo')).toBe(undefined);
	});
	test('should get a key with string ttl', async () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar', '20ms');
		await sleep(30);
		expect(cache.get<string>('foo')).toBe(undefined);
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
	test('cache id to default', () => {
		const cache = new FlatCache();
		expect(cache.cacheId).toBe('cache1');
		cache.cacheId = 'cache2';
		expect(cache.cacheId).toBe('cache2');
	});
	test('destroy should remove the directory, file, and memory cache', () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar');
		cache.save();
		cache.destroy();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(false);
		expect(fs.existsSync(cache.cacheDirPath)).toBe(false);
		expect(cache.cache.get('foo')).toBeUndefined();
	});
});

describe('flat-cache file cache', () => {
	test('should be able to see the cache path', () => {
		const cache = new FlatCache();
		expect(cache.cacheFilePath).toContain('.cache/cache1');
	});
	test('save the cache', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		cache.setKey('bar', {foo: 'bar'});
		cache.setKey('baz', [1, 2, 3]);
		cache.setKey('qux', 123);
		cache.save();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
	});
	test('do a custome cache path and cache id', () => {
		const cache = new FlatCache({cacheDir: '.cachefoo', cacheId: 'cache2'});
		expect(cache.cacheFilePath).toContain('.cachefoo/cache2');
		cache.setKey('bar', {foo: 'bar'});
		cache.setKey('baz', [1, 2, 3]);
		cache.save();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
	});
	test('should be able to delete the file cache', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		cache.save();
		cache.removeCacheFile();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(false);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
	});
	test('should return false to delete the file cache', () => {
		const cache = new FlatCache();
		expect(cache.removeCacheFile()).toBe(false);
	});
});
