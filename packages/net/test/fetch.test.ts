import process from 'node:process';
import {describe, test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {Cacheable} from 'cacheable';
import {fetch, type FetchOptions} from '../src/fetch.js';

const testUrl = process.env.TEST_URL ?? 'https://mockhttp.org';
const testTimeout = 10_000; // 10 seconds

describe('Fetch', () => {
	test('should fetch data successfully', async () => {
		const url = `${testUrl}/get`;
		const options: FetchOptions = {
			method: 'GET',
			cache: new Cacheable(),
		};
		const response = await fetch(url, options);
		expect(response).toBeDefined();
	}, testTimeout);

	test('should fetch data successfully from cache', async () => {
		const cache = new Cacheable({stats: true});
		const url = `${testUrl}/get`;
		const options: FetchOptions = {
			method: 'GET',
			cache,
		};
		const response = await fetch(url, options);
		expect(response).toBeDefined();
		await fetch(url, options); // Fetch again to test cache
		expect(cache.stats.hits).toBe(1);
		await fetch(url, options); // Fetch again to test cache
		expect(cache.stats.hits).toBe(2);
	}, testTimeout);
});
