/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
	describe, it, expect, vi,
} from 'vitest';
import {Cacheable, CacheableMemory} from '../src/index.js';
import {wrap, type WrapOptions} from '../src/wrap.js';

describe('wrap function', () => {
	it('should cache asynchronous function results', async () => {
		// Mock cache and async function
		const asyncFunction = async (a: number, b: number) => a + b;
		const cache = new Cacheable();
		cache.hash = vi.fn(() => 'cacheKey');
		cache.get = vi.fn(async () => undefined);
		cache.set = vi.fn();

		const memoryCache = new CacheableMemory();
		memoryCache.get = vi.fn(() => undefined);
		memoryCache.set = vi.fn();

		const options: WrapOptions = {
			cache,
			memoryCache, // Not used in async case
		};

		// Wrap the async function
		const wrapped = wrap(asyncFunction, options);

		// Call the wrapped function
		const result = await wrapped(1, 2);

		// Expectations
		expect(result).toBe(3);
		expect(cache.hash).toHaveBeenCalledWith([1, 2]);
		expect(cache.get).toHaveBeenCalledWith('cacheKey');
		expect(cache.set).toHaveBeenCalledWith('cacheKey', 3, undefined);
	});

	it('should return cached async value if it exists', async () => {
		// Mock cache and async function
		const asyncFunction = async (value: number) => Math.random() * value;
		const cache = new Cacheable();
		cache.hash = vi.fn(() => 'cacheKey');
		cache.get = vi.fn(async () => undefined);
		cache.set = vi.fn();

		const memoryCache = new CacheableMemory();
		memoryCache.get = vi.fn(() => undefined);
		memoryCache.set = vi.fn();

		const options: WrapOptions = {
			cache,
			memoryCache, // Not used in async case
		};

		// Wrap the async function
		const wrapped = wrap(asyncFunction, options);

		// Call the wrapped function
		const result = await wrapped();
		const result2 = await wrapped();
		// Expectations
		expect(result).toBe(result2);
		expect(cache.get).toHaveBeenCalledWith('cacheKey');
		expect(cache.set).toHaveBeenCalled();
	});
/*
	It('should cache synchronous function results', () => {
		// Mock cache and sync function
		const syncFunction = vi.fn((a: number, b: number) => a + b);
		const cache = new Cacheable();
		cache.hash = vi.fn(() => 'cacheKey');
		cache.get = vi.fn(async () => undefined);
		cache.set = vi.fn();

		const memoryCache = new CacheableMemory();
		memoryCache.get = vi.fn(() => undefined);
		memoryCache.set = vi.fn();

		const options: WrapOptions = {
			cache,
			memoryCache,
		};

		// Wrap the sync function
		const wrapped = wrap(syncFunction, options);

		// Call the wrapped function
		const result = wrapped(1, 2);

		// Expectations
		expect(result).toBe(3);
		expect(memoryCache.get).toHaveBeenCalledWith('cacheKey');
		expect(memoryCache.set).toHaveBeenCalledWith('cacheKey', 3, undefined);
		expect(syncFunction).toHaveBeenCalledTimes(1);
	});

	it('should return cached sync value if it exists', () => {
		// Mock cache and sync function
		const syncFunction = vi.fn(() => 0);
		const cache = new Cacheable();
		cache.hash = vi.fn(() => 'cacheKey');
		cache.get = vi.fn(async () => undefined);
		cache.set = vi.fn();

		const memoryCache = new CacheableMemory();
		memoryCache.get = vi.fn(() => undefined);
		memoryCache.set = vi.fn();

		const options: WrapOptions = {
			cache, // Not used in sync case
			memoryCache,
		};

		// Wrap the sync function
		const wrapped = wrap(syncFunction, options);

		// Call the wrapped function
		const result = wrapped();

		// Expectations
		expect(result).toBe(42);
		expect(memoryCache.get).toHaveBeenCalledWith('cacheKey');
		expect(memoryCache.set).not.toHaveBeenCalled();
		expect(syncFunction).not.toHaveBeenCalled();
	});
*/
});
