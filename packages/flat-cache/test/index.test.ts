import {describe, test, expect} from 'vitest';
import {FlatCache} from '../src/index.js';

describe('flat-cache', () => {
	test('should initialize', () => {
		const cache = new FlatCache();
		expect(cache.cache).toBeDefined();
	});
});
