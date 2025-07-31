
import {describe, test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {Cacheable, type CacheableOptions} from 'cacheable';
import {CacheableNet, Net, type CacheableNetOptions} from '../src/index.js';

describe('Cacheable Net', () => {
	test('should create an instance of CacheableNet', () => {
		const instance = new CacheableNet();
		expect(instance).toBeInstanceOf(CacheableNet);
	});

	test('should create an instance of Net', () => {
		const instance = new Net();
		expect(instance).toBeInstanceOf(CacheableNet);
	});

	test('should create an instance with cache instance', () => {
		const cacheOptions: CacheableNetOptions = {
			cache: new Cacheable({ttl: '1h'}),
		};
		const instance = new CacheableNet(cacheOptions);
		expect(instance.cache).toBeInstanceOf(Cacheable);
		expect(instance.cache.ttl).toBe('1h');
	});

	test('should create an instance with custom cache options', () => {
		const cacheOptions: CacheableNetOptions = {
			cache: {
				ttl: '2h',
			},
		};
		const instance = new CacheableNet(cacheOptions);
		expect(instance.cache).toBeInstanceOf(Cacheable);
		expect(instance.cache.ttl).toBe('2h');

		// Set a new cache instance
		const newCache = new Cacheable({ttl: '3h'});
		instance.cache = newCache;
		expect(instance.cache).toBe(newCache);
	});
});
