import {describe, test, expect} from 'vitest';
import {sleep} from '../src/sleep.js';

describe('index', () => {
	test('exports are correct', async () => {
		const utils = await import('../src/index.js');
		expect(utils).toHaveProperty('coalesceAsync');
		expect(utils).toHaveProperty('hash');
		expect(utils).toHaveProperty('hashToNumber');
		expect(utils).toHaveProperty('HashAlgorithm');
		expect(utils).toHaveProperty('shorthandToTime');
		expect(utils).toHaveProperty('shorthandToMilliseconds');
		expect(utils).toHaveProperty('sleep');
		expect(utils).toHaveProperty('Stats');
		expect(utils).toHaveProperty('getTtlFromExpires');
		expect(utils).toHaveProperty('getCascadingTtl');
		expect(utils).toHaveProperty('calculateTtlFromExpiration');
	});
});

describe('sleep', () => {
	test('should resolve after the specified time', async () => {
		const start = Date.now();
		await sleep(100);
		const end = Date.now();
		expect(end - start).toBeGreaterThanOrEqual(95);
	});
});
