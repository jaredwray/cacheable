
import process from 'node:process';
import {describe, test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {Cacheable} from 'cacheable';
import {
	CacheableNet, fetch, Net, type CacheableNetOptions, type FetchOptions,
} from '../src/index.js';

const testUrl = process.env.TEST_URL ?? 'https://mockhttp.org';

describe('Cacheable Net', () => {
	test('should create an instance of CacheableNet', () => {
		const net = new CacheableNet();
		expect(net).toBeInstanceOf(CacheableNet);
	});

	test('should create an instance of Net', () => {
		const net = new Net();
		expect(net).toBeInstanceOf(CacheableNet);
	});

	test('should create an instance with cache instance', async () => {
		const cacheOptions: CacheableNetOptions = {
			cache: new Cacheable({ttl: '1h'}),
		};
		const net = new CacheableNet(cacheOptions);
		expect(net.cache).toBeInstanceOf(Cacheable);
		expect(net.cache.ttl).toBe('1h');

		// Do a quick test to ensure the cache is working
		const data = {key: faker.string.uuid(), value: faker.string.alpha(10)};
		await net.cache.set(data.key, data.value);
		const cachedValue = await net.cache.get(data.key);
		expect(cachedValue).toBe(data.value);
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
	test('should fetch data using fetch method', async () => {
		const url = `${testUrl}/get`;
		const options: FetchOptions = {
			method: 'GET',
			cacheable: new Cacheable(),
		};
		const response = await fetch(url, options);
		expect(response).toBeDefined();
	});
});
