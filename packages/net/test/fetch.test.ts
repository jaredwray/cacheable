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
	}, testTimeout);

	test('should throw an error if cache is not provided', async () => {
		const url = `${testUrl}/get`;
		const options: FetchOptions = {
			method: 'GET',
			cache: undefined as unknown as Cacheable, // Force error
		};
		await expect(fetch(url, options)).rejects.toThrow('Fetch options must include a cache instance or options.');
	}, testTimeout);
});
