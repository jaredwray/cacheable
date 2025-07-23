import fs from 'node:fs';
import {describe, test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import defaultFlatCache, {
	FlatCache, create, createFromFile, clearAll, clearCacheById,
} from '../src/index.js';

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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		const values = cache.items.map(item => item.value);
		expect(values).toContain('bar');
		expect(values).toContain('baz');
		expect(values).toContain('foo');
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
		expect(cache.cache.get('foo')).toBeUndefined();
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
	});
	test('should clear the cache', () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar');
		cache.clear();
		expect(cache.cache.size).toBe(0);
	});
	test('should not save to disk if no changes', () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar');
		expect(cache.changesSinceLastSave).toBe(true);
		cache.save();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
		expect(cache.changesSinceLastSave).toBe(false);
		cache.save(true);
		expect(cache.changesSinceLastSave).toBe(false);
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
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
		expect(cache.changesSinceLastSave).toBe(true);
		cache.save();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
	});
	test('do a custom cache path and cache id', () => {
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
	test('auto save the cache', async () => {
		const cache = new FlatCache({
			cacheDir: '.cachefoo2',
			cacheId: 'cache3',
			persistInterval: 100,
		});
		cache.setKey('foo', 'bar');
		cache.startAutoPersist();
		await sleep(200);
		cache.stopAutoPersist();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
	});
});

describe('flat-cache load from persisted cache', () => {
	test('should load the cache from the file', () => {
		const cacheDir = '.cachefoo3';
		const cacheId = 'cache4';
		const firstCache = new FlatCache({cacheDir, cacheId});
		firstCache.setKey('foo', 'bar');
		firstCache.setKey('bar', {foo: 'bar'});
		firstCache.setKey('baz', [1, 2, 3]);
		firstCache.save();
		const secondCache = new FlatCache();
		secondCache.load(cacheId, cacheDir);
		expect(secondCache.getKey('foo')).toBe('bar');
		expect(secondCache.getKey('bar')).toEqual({foo: 'bar'});
		expect(secondCache.getKey('baz')).toEqual([1, 2, 3]);
		firstCache.destroy();
	});
	test('should load the cache from the file', () => {
		const cacheDir = '.cachefoo3';
		const cacheId = 'cache4';
		const firstCache = new FlatCache({cacheDir, cacheId});
		firstCache.setKey('foo', 'bar');
		firstCache.setKey('bar', {foo: 'bar'});
		firstCache.setKey('baz', [1, 2, 3]);
		firstCache.save();
		const secondCache = new FlatCache({cacheDir});
		secondCache.load(cacheId);
		expect(secondCache.getKey('foo')).toBe('bar');
		expect(secondCache.getKey('bar')).toEqual({foo: 'bar'});
		expect(secondCache.getKey('baz')).toEqual([1, 2, 3]);
		firstCache.destroy(true);
	});

	test('should load the cache from the file with expiration', async () => {
		const cacheDir = '.cachefoo3';
		const cacheId = 'cache4';
		const firstCache = new FlatCache({cacheDir, cacheId});
		firstCache.setKey('foo', 'bar', 250);
		firstCache.setKey('bar', {foo: 'bar'}, 500);
		firstCache.setKey('baz', [1, 2, 3]);
		firstCache.save();
		const secondCache = new FlatCache({cacheDir});
		secondCache.load(cacheId);
		expect(secondCache.getKey('foo')).toBe('bar');
		expect(secondCache.getKey('bar')).toEqual({foo: 'bar'});
		expect(secondCache.getKey('baz')).toEqual([1, 2, 3]);
		await sleep(300);
		expect(secondCache.getKey('foo')).toBeUndefined();
		expect(secondCache.getKey('bar')).toEqual({foo: 'bar'});
		expect(secondCache.getKey('baz')).toEqual([1, 2, 3]);
		await sleep(300);
		expect(secondCache.getKey('bar')).toBeUndefined();
		firstCache.destroy(true);
	});

	test('should load cache via file stream', async () => {
		let progressCount = 0;
		const onProgress = (progress: number, total: number) => {
			progressCount++;
			expect(progress).toBeGreaterThanOrEqual(0);
			expect(total).toBeGreaterThan(0);
		};

		let errorCount = 0;
		const onError = (error: Error) => {
			errorCount++;
			expect(error).toBeInstanceOf(Error);
		};

		let endCount = 0;
		const onEnd = () => {
			endCount++;
		};

		const cacheDir = '.cachefoo3';
		const cacheId = 'cache4';
		const firstCache = new FlatCache({cacheDir, cacheId});
		firstCache.setKey('foo', 'bar');
		firstCache.setKey('bar', {foo: 'bar'});
		firstCache.setKey('baz', [1, 2, 3]);
		firstCache.save();
		const secondCache = new FlatCache({cacheDir});

		secondCache.loadFileStream(firstCache.cacheFilePath, onProgress, onEnd, onError);

		await sleep(400);

		expect(secondCache.getKey('foo')).toBe('bar');
		expect(secondCache.getKey('bar')).toEqual({foo: 'bar'});
		expect(secondCache.getKey('baz')).toEqual([1, 2, 3]);

		expect(progressCount).toBeGreaterThan(0);
		expect(endCount).toBe(1);
		expect(errorCount).toBe(0);
		fs.rmSync(firstCache.cacheDirPath, {recursive: true, force: true});
		firstCache.destroy(true);
	});

	test('should error on file stream load with bad path', async () => {
		const cache = new FlatCache();
		let errorMessage;

		const onError = (error: Error) => {
			errorMessage = error.message;
		};

		// eslint-disable-next-line @typescript-eslint/no-empty-function
		cache.loadFileStream('bad/path/to/file', () => {}, () => {}, onError);

		await sleep(10);

		expect(errorMessage).toBeDefined();
	});
});

describe('flat-cache exported functions', () => {
	test('should create a new cache', () => {
		const cache = create({cacheId: 'cache5'});
		expect(cache.cacheId).toBe('cache5');
	});
	test('should create a new cache with directory', () => {
		const cache = create({cacheDir: '.cachefoo5', cacheId: 'cache5'});
		expect(cache.cacheId).toBe('cache5');
		expect(cache.cacheDir).toBe('.cachefoo5');
	});
	test('should create a new cache from file', () => {
		const firstCache = new FlatCache({cacheDir: '.cachefoo4', cacheId: 'cache6'});
		firstCache.setKey('foo', 'bar');
		firstCache.setKey('bar', {foo: 'bar'});
		firstCache.setKey('baz', [1, 2, 3]);
		firstCache.save();
		const filePath = firstCache.cacheFilePath;
		const cache = createFromFile(filePath);
		expect(cache.getKey('foo')).toBe('bar');
		expect(cache.getKey('bar')).toEqual({foo: 'bar'});
		expect(cache.getKey('baz')).toEqual([1, 2, 3]);
		fs.rmSync(firstCache.cacheDirPath, {recursive: true, force: true});
	});
	test('should clear all caches', () => {
		const cache1 = create({cacheId: 'cache1'});
		const cache2 = create({cacheId: 'cache2'});
		clearAll();
		expect(cache1.cache.size).toBe(0);
		expect(cache2.cache.size).toBe(0);
		expect(fs.existsSync(cache1.cacheFilePath)).toBe(false);
		expect(fs.existsSync(cache2.cacheFilePath)).toBe(false);
	});
	test('should clear cache by id', () => {
		const cacheId = faker.string.alphanumeric(10);
		const cache = create({cacheId});
		const data = {
			key: faker.string.alphanumeric(10),
			value: faker.string.alphanumeric(20),
		};
		cache.set(data.key, data.value);
		cache.save();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		clearCacheById(cacheId);
		expect(fs.existsSync(cache.cacheFilePath)).toBe(false);
	});
});

describe('flat-cache with JSON', () => {
	test('should be able to set and get via JSON parse and stringify methods', () => {
		const options = {
			serialize: JSON.stringify,
			deserialize: JSON.parse,
		};
		const cache = new FlatCache(options);
		cache.set('foo', {bar: 'baz'});
		cache.set('bar', [1, 2, 3]);
		expect(cache.get('foo')).toEqual({bar: 'baz'});
		expect(cache.get('bar')).toEqual([1, 2, 3]);
		cache.save();
		expect(fs.existsSync(cache.cacheFilePath)).toBe(true);
		const cache2 = new FlatCache(options);
		cache2.load();
		expect(cache2.get('foo')).toEqual({bar: 'baz'});
		expect(cache2.get('bar')).toEqual([1, 2, 3]);
		fs.rmSync(cache.cacheDirPath, {recursive: true, force: true});
	});
});

describe('flat cache as a default export for create', () => {
	test('should create a new cache', () => {
		const cache = defaultFlatCache.create({cacheId: 'cache5'});
		expect(cache.cacheId).toBe('cache5');
	});
});
