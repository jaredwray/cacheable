import fs from 'node:fs';
import {describe, test, expect} from 'vitest';
import defaultFileEntryCache, {FileEntryCache} from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('file-entry-cache with options', () => {
	test('should initialize', () => {
		const fileEntryCache = new FileEntryCache();
		expect(fileEntryCache).toBeDefined();
	});

	test('should be able to set flat-cache options', () => {
		const fileEntryCache = new FileEntryCache({cache: {cacheId: 'test'}});
		expect(fileEntryCache.cache.cacheId).toBe('test');
	});

	test('should be able to get and set FlatCache', () => {
		const fileEntryCache = new FileEntryCache();
		const newFileEntryCache = new FileEntryCache();
		fileEntryCache.cache = newFileEntryCache.cache;
		expect(fileEntryCache.cache).toBe(newFileEntryCache.cache);
	});

	test('should be able to get and set useCheckSum', () => {
		const fileEntryCache = new FileEntryCache({useCheckSum: true});
		expect(fileEntryCache.useCheckSum).toBe(true);
		fileEntryCache.useCheckSum = false;
		expect(fileEntryCache.useCheckSum).toBe(false);
	});

	test('should be able to get and set currentWorkingDirectory', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: 'test'});
		expect(fileEntryCache.currentWorkingDirectory).toBe('test');
		fileEntryCache.currentWorkingDirectory = 'test2';
		expect(fileEntryCache.currentWorkingDirectory).toBe('test2');
	});

	test('create should initialize a file-entry-cache', () => {
		const fileEntryCache = defaultFileEntryCache.create();
		expect(fileEntryCache).toBeDefined();
	});
});

describe('file-entry-cache - getHash', () => {
	test('should return a hash', () => {
		const fileEntryCache = new FileEntryCache();
		const buffer = Buffer.from('test');
		const hash = fileEntryCache.getHash(buffer);
		expect(hash).toBeDefined();
	});
	test('empty buffer should return md5 empty hash', () => {
		const fileEntryCache = new FileEntryCache();
		const buffer = Buffer.from('');
		const hash = fileEntryCache.getHash(buffer);
		expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e'); // Md5 hash of empty string
	});
});

describe('file-entry-cache - getFileKey', () => {
	test('should return a key', () => {
		const fileEntryCache = new FileEntryCache();
		const key = fileEntryCache.createFileKey('test');
		expect(key).toBe('test');
	});
	test('should return a correct path key', () => {
		const fileEntryCache = new FileEntryCache();
		const path = '/usr/src/test2/test';
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
	test('should return a correct path key with cwd', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: '/usr/src/test2'});
		const path = '/usr/src/test2/test.file';
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe('/test.file');
	});
	test('should return full path when cwd is full path', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: '/usr/src/test2'});
		const path = '/usr/src/test2';
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
});

describe('file-entry-cache - destroy()', () => {
	test('should return false to delete the file cache', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('foo', 'bar');
		expect(fileEntryCache.cache.all()).toEqual({foo: 'bar'});
		fileEntryCache.destroy();
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe('file-entry-cache - removeEntry()', () => {
	test('should remove the entry', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('foo', 'bar');
		expect(fileEntryCache.cache.all()).toEqual({foo: 'bar'});
		fileEntryCache.removeEntry('foo');
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe('file-entry-cache - removeCacheFile()', () => {
	test('should remove the cache file', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('foo', 'bar');
		expect(fileEntryCache.cache.all()).toEqual({foo: 'bar'});
		fileEntryCache.reconcile();
		expect(fs.existsSync(fileEntryCache.cache.cacheFilePath)).toBe(true);
		fileEntryCache.deleteCacheFile();
		expect(fs.existsSync(fileEntryCache.cache.cacheFilePath)).toBe(false);
		// Clean up
		fs.rmSync(fileEntryCache.cache.cacheDirPath, {recursive: true, force: true});
	});
});
