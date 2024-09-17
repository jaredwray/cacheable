import {describe, test, expect} from 'vitest';
import {NodeCacheStore} from '../src/store.js';

describe('NodeCacheStore', () => {
	test('should create a new instance', () => {
		const store = new NodeCacheStore();
		expect(store).toBeDefined();
	});
	test('should create a new instance with options', () => {
		const store = new NodeCacheStore({maxKeys: 100});
		expect(store.maxKeys).toBe(100);
		store.maxKeys = 200;
		expect(store.maxKeys).toBe(200);
	});
});
