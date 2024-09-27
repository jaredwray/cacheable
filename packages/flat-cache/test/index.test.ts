import {describe, test, expect} from 'vitest';
import {FlatCache} from '../src/index.js';

describe('flat-cache', () => {
	test('should initialize', () => {
		const cache = new FlatCache();
		expect(cache.cache).toBeDefined();
	});
	test('should get all keys', () => {
		const cache = new FlatCache();
		expect(cache.keys()).toBeDefined();
		expect(cache.all()).toBeDefined();
	});
	test('should set key', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		expect(cache.all().foo).toBe('bar');
	});
	test('should remove key', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		cache.removeKey('foo');
		expect(cache.getKey('foo')).toBeUndefined();
	});
});
