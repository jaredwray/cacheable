import {describe, test, expect} from 'vitest';
import {FlatCache} from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
	test('should set legacy key', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		expect(cache.all().foo).toBe('bar');
	});
	test('should set a key with a ttl', async () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar', 10);
		await sleep(20);
		expect(cache.getKey('foo')).toBe(undefined);
	});
	test('should get a key', () => {
		const cache = new FlatCache();
		cache.set('foo', 'bar');
		expect(cache.get<string>('foo')).toBe('bar');
	});
	test('should remove key', () => {
		const cache = new FlatCache();
		cache.setKey('foo', 'bar');
		cache.removeKey('foo');
		expect(cache.getKey('foo')).toBeUndefined();
	});
});
