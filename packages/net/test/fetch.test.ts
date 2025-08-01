import process from 'node:process';
import {describe, test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {Cacheable} from 'cacheable';
import {fetch, type FetchOptions} from '../src/fetch.js';

const testUrl = process.env.TEST_URL ?? 'https://mockhttp.org';

describe('Fetch', () => {
	test('should fetch data successfully', async () => {
		const url = `${testUrl}/get`;
		const options: FetchOptions = {
			method: 'GET',
			cacheable: new Cacheable(),
		};
		const response = await fetch(url, options);
		expect(response).toBeDefined();
	});
});
