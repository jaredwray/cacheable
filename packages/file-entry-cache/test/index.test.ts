import {describe, test, expect} from 'vitest';
import {FileEntryCache} from '../src/index.js';

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
});
