import {
	describe, test, expect, vi,
} from 'vitest';
import {Cacheable} from 'cacheable';
import {getOrSet, type GetOrSetOptions} from '../src/index.js';

describe('cacheable get or set', () => {
	test('should cache results', async () => {
		const cacheable = new Cacheable();
		const function_ = vi.fn(async () => 1 + 2);
		const result = await getOrSet('one_plus_two', function_, {cache: cacheable});
		await getOrSet('one_plus_two', function_, {cache: cacheable});
		expect(result).toBe(3);
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test('should prevent stampede', async () => {
		const cacheable = new Cacheable();
		const function_ = vi.fn(async () => 42);
		await Promise.all([
			getOrSet('key1', function_, {cache: cacheable}),
			getOrSet('key1', function_, {cache: cacheable}),
			getOrSet('key2', function_, {cache: cacheable}),
			getOrSet('key2', function_, {cache: cacheable}),
		]);
		expect(function_).toHaveBeenCalledTimes(2);
	});

	test('should throw on getOrSet error', async () => {
		const cacheable = new Cacheable();
		const function_ = vi.fn(async () => {
			throw new Error('Test error');
		});

		await expect(getOrSet('key', function_, {cache: cacheable, throwErrors: true})).rejects.toThrow('Test error');
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test('should throw on getOrSet error with cache errors true', async () => {
		const cacheable = new Cacheable();
		const function_ = vi.fn(async () => {
			throw new Error('Test error');
		});

		await expect(getOrSet('key', function_, {cache: cacheable, throwErrors: true, cacheErrors: true})).rejects.toThrow('Test error');
		expect(function_).toHaveBeenCalledTimes(1);
	});

	test('should generate key via function on getOrSet', async () => {
		const cacheable = new Cacheable();
		const generateKey = (options?: GetOrSetOptions) => `custom_key_${options?.cacheId}`;
		const function_ = vi.fn(async () => Math.random() * 100);
		const result1 = await getOrSet(generateKey, function_, {cache: cacheable});
		const result2 = await getOrSet(generateKey, function_, {cache: cacheable});
		expect(result1).toBe(result2);
	});
});
