
import {describe, test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {Cacheable, type CacheableOptions} from 'cacheable';
import {CacheableNet, Net, type CacheableNetOptions} from '../src/index.js';

describe('Cacheable Net', () => {
	test('should create an instance of CacheableNet', () => {
		const net = new CacheableNet();
		expect(net).toBeInstanceOf(CacheableNet);
	});

	test('should create an instance of Net', () => {
		const net = new Net();
		expect(net).toBeInstanceOf(CacheableNet);
	});

	test('should create an instance with cache instance', () => {
		const cacheOptions: CacheableNetOptions = {
			cache: new Cacheable({ttl: '1h'}),
		};
		const net = new CacheableNet(cacheOptions);
		expect(net.cache).toBeInstanceOf(Cacheable);
		expect(net.cache.ttl).toBe('1h');
	});

	test('should create an instance with custom cache options', () => {
		const cacheOptions: CacheableNetOptions = {
			cache: {
				ttl: '2h',
			},
		};
		const net = new Net(cacheOptions);
		expect(net.cache).toBeInstanceOf(Cacheable);
		expect(net.cache.ttl).toBe('2h');

		// Set a new cache instance
		const newCache = new Cacheable({ttl: '3h'});
		net.cache = newCache;
		expect(net.cache).toBe(newCache);
	});
});
