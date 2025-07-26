/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
	describe, it, expect, vi,
} from 'vitest';
import {Cacheable, CacheableMemory} from 'cacheable';
import {sleep} from '@cacheable/utils';
import {
	wrap, createWrapKey, wrapSync, type WrapOptions, type WrapSyncOptions,
} from '../src/index.js';

describe('wrap function', () => {
	it('should cache asynchronous function results', async () => {
		const asyncFunction = async (a: number, b: number) => a + b;
		const cache = new Cacheable();

		const options: WrapOptions = {
			keyPrefix: 'cacheKey',
			cache,
		};

		// Wrap the async function
		const wrapped = wrap(asyncFunction, options);

		// Call the wrapped function
		const result = await wrapped(1, 2);

		// Expectations
		expect(result).toBe(3);
		const cacheKey = createWrapKey(asyncFunction, [1, 2], options.keyPrefix);
		const cacheResult = await cache.get(cacheKey);
		expect(cacheResult).toBe(3);
	});

	it('should return cached async value with hash', async () => {
		// Mock cache and async function
		const asyncFunction = async (value: number) => Math.random() * value;
		const cache = new Cacheable();

		const options: WrapOptions = {
			cache,
		};

		// Wrap the async function
		const wrapped = wrap(asyncFunction, options);

		// Call the wrapped function
		const result = await wrapped(12);
		const result2 = await wrapped(12);
		// Expectations
		expect(result).toBe(result2);
	});

	it('should cache synchronous function results', () => {
		// Mock cache and sync function
		const syncFunction = (value: number) => Math.random() * value;
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			cache,
		};

		// Wrap the sync function
		const wrapped = wrapSync(syncFunction, options);

		// Call the wrapped function
		const result = wrapped(1, 2);
		const result2 = wrapped(1, 2);

		// Expectations
		expect(result).toBe(result2);
		const cacheKey = createWrapKey(syncFunction, [1, 2], options.keyPrefix);
		const cacheResult = cache.get(cacheKey);
		expect(cacheResult).toBe(result);
	});

	it('should cache synchronous function results with hash', () => {
		// Mock cache and sync function
		const syncFunction = (value: number) => Math.random() * value;
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			keyPrefix: 'testPrefix',
			cache,
		};

		// Wrap the sync function
		const wrapped = wrapSync(syncFunction, options);

		// Call the wrapped function
		const result = wrapped(1, 2);
		const result2 = wrapped(1, 2);

		// Expectations
		expect(result).toBe(result2);
	});

	it('should cache synchronous function results with key and ttl', async () => {
		// Mock cache and sync function
		const syncFunction = (value: number) => Math.random() * value;
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			cache,
			ttl: 10,
			keyPrefix: 'cacheKey',
		};

		// Wrap the sync function
		const wrapped = wrapSync(syncFunction, options);

		// Call the wrapped function
		const result = wrapped(1, 2);
		const result2 = wrapped(1, 2);

		// Expectations
		expect(result).toBe(result2);
		await sleep(30);
		const cacheKey = createWrapKey(syncFunction, [1, 2], options.keyPrefix);
		const cacheResult = cache.get(cacheKey);
		expect(cacheResult).toBe(undefined);
	});

	it('should cache synchronous function results with complex args', async () => {
		// Mock cache and sync function
		const syncFunction = (value: number, person: {first: string; last: string; meta: any}) => Math.random() * value;
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			keyPrefix: 'cacheKey',
			cache,
		};

		// Wrap the sync function
		const wrapped = wrapSync(syncFunction, options);

		// Call the wrapped function
		const result = wrapped(1, {first: 'John', last: 'Doe', meta: {age: 30}});
		const result2 = wrapped(1, {first: 'John', last: 'Doe', meta: {age: 30}});

		// Expectations
		expect(result).toBe(result2);
	});

	it('should cache synchronous function results with complex args and shorthand ttl', async () => {
		// Mock cache and sync function
		const syncFunction = (value: number, person: {first: string; last: string; meta: any}) => Math.random() * value;
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			cache,
			ttl: '100ms',
			keyPrefix: 'cacheKey',
		};

		// Wrap the sync function
		const wrapped = wrapSync(syncFunction, options);

		// Call the wrapped function
		const result = wrapped(1, {first: 'John', last: 'Doe', meta: {age: 30}});
		const result2 = wrapped(1, {first: 'John', last: 'Doe', meta: {age: 30}});

		// Expectations
		expect(result).toBe(result2);
		await sleep(200);
		const cacheKey = createWrapKey(wrapSync, [1, {first: 'John', last: 'Doe', meta: {age: 30}}], options.keyPrefix);
		const cacheResult = cache.get(cacheKey);
		expect(cacheResult).toBe(undefined);
	});
});

describe('wrap function with stampede protection', () => {
	it('should only execute the wrapped function once when called concurrently with the same key', async () => {
		const cache = new Cacheable();
		const mockFunction = vi.fn().mockResolvedValue('result');
		const mockedKey = createWrapKey(mockFunction, ['arg1'], 'test');
		const wrappedFunction = wrap(mockFunction, {cache, keyPrefix: 'test'});

		// Call the wrapped function concurrently
		const [result1, result2, result3, result4] = await Promise.all([wrappedFunction('arg1'), wrappedFunction('arg1'), wrappedFunction('arg2'), wrappedFunction('arg2')]);

		// Verify that the wrapped function was only called two times do to arg1 and arg2
		expect(mockFunction).toHaveBeenCalledTimes(2);

		// Verify that both calls returned the same result
		expect(result1).toBe('result');
		expect(result2).toBe('result');
		expect(result3).toBe('result');

		// Verify that the result was cached
		expect(await cache.has(mockedKey)).toBe(true);
	});

	it('should handle error if the function fails', async () => {
		const cache = new Cacheable();
		const mockFunction = vi.fn().mockRejectedValue(new Error('Function failed'));
		const mockedKey = createWrapKey(mockFunction, ['arg1'], 'test');
		const wrappedFunction = wrap(mockFunction, {cache, keyPrefix: 'test'});

		await wrappedFunction('arg1');

		// Verify that the wrapped function was only called once
		expect(mockFunction).toHaveBeenCalledTimes(1);
	});
});

describe('wrap functions handling thrown errors', () => {
	it('wrapSync should emit an error by default and return undefined but not cache errors', () => {
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			cache,
			ttl: '1s',
			keyPrefix: 'cacheKey',
		};

		const wrapped = wrapSync(() => {
			throw new Error('Test error');
		}, options);

		let errorCallCount = 0;

		cache.on('error', error => {
			expect(error.message).toBe('Test error');
			errorCallCount++;
		});

		const result = wrapped();

		expect(result).toBe(undefined);
		expect(errorCallCount).toBe(1);
		const values = [...cache.items];
		expect(values.length).toBe(0);
	});

	it('wrapSync should cache the error when the property is set', () => {
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			cache,
			ttl: '1s',
			keyPrefix: 'cacheKey',
			cacheErrors: true,
		};

		const wrapped = wrapSync(() => {
			throw new Error('Test error');
		}, options);

		let errorCallCount = 0;

		cache.on('error', error => {
			expect(error.message).toBe('Test error');
			errorCallCount++;
		});

		wrapped();
		wrapped(); // Should be cached

		expect(errorCallCount).toBe(1);
	});

	it('wrap should throw an error if the wrapped function throws an error', async () => {
		const cache = new Cacheable();
		const error = new Error('Test error');
		const options: WrapOptions = {
			cache,
			ttl: '1s',
			keyPrefix: 'cacheKey',
		};
		const wrapped = wrap(() => {
			throw error;
		}, options);

		let errorCallCount = 0;

		cache.on('error', error_ => {
			expect(error_).toBe(error);
			errorCallCount++;
		});

		expect(await wrapped()).toBe(undefined);
		const cacheKey = createWrapKey(() => {
			throw error;
		}, [], options.keyPrefix);
		const result = await cache.get(cacheKey);
		expect(result).toBe(undefined);
		expect(errorCallCount).toBe(1);
	});

	it('wrap should cache the error when the property is set', async () => {
		const cache = new Cacheable();
		const error = new Error('Test error');
		const options: WrapOptions = {
			cache,
			ttl: '1s',
			keyPrefix: 'cacheKey',
			cacheErrors: true,
		};
		const wrapped = wrap(() => {
			throw error;
		}, options);

		let errorCallCount = 0;

		cache.on('error', error_ => {
			expect(error_).toBe(error);
			errorCallCount++;
		});

		await wrapped();
		await wrapped(); // Should be cached

		expect(errorCallCount).toBe(1);
	});

	it('can use createKey function to generate cache keys', async () => {
		const cache = new Cacheable();
		const options: WrapOptions = {
			cache,
			keyPrefix: 'test',
			createKey: (function_, arguments_, options) => `customKey:${options?.keyPrefix}:${arguments_[0]}`,
		};

		const wrapped = wrap((argument: string) => `Result for ${argument}`, options);

		const result1 = await wrapped('arg1');
		const result2 = await wrapped('arg1'); // Should hit the cache

		expect(result1).toBe(result2);
	});

	it('can use createKey function to generate cache keys with wrapSync', () => {
		const cache = new CacheableMemory();
		const options: WrapSyncOptions = {
			cache,
			keyPrefix: 'test',
			createKey: (function_, arguments_, options) => `customKey:${options?.keyPrefix}:${arguments_[0]}`,
		};

		const wrapped = wrapSync((argument: string) => `Result for ${argument}`, options);

		const result1 = wrapped('arg1');
		const result2 = wrapped('arg1'); // Should hit the cache

		expect(result1).toBe(result2);
	});
});
