import {describe, test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {coalesceAsync} from '../src/coalesce-async.js';

describe('coalesceAsync', () => {
	test('returns a function that coalesces calls', async () => {
		const key = faker.string.alphanumeric(10);
		let callCount = 0;
		const fn = async () => {
			callCount++;
			return 'result';
		};

		const result = await Promise.all([
			coalesceAsync(key, fn),
			coalesceAsync(key, fn),
			coalesceAsync(key, fn),
		]);

		expect(result).toEqual(['result', 'result', 'result']);
		expect(callCount).toBe(1);
	});
});
