import {expect, test, describe} from 'vitest';
import {CacheableHashStore} from '../src/hash-store.js';

describe('CacheableHashStore', () => {
	test('hash key should be the correct number', () => {
		const cache = new CacheableHashStore();
		expect(cache.hashKey('apple')).toBe(0);
		expect(cache.hashKey('carrot')).toBe(1);
		expect(cache.hashKey('4123')).toBe(2);
		expect(cache.hashKey('mouse')).toBe(3);
		expect(cache.hashKey('dog')).toBe(4);
		expect(cache.hashKey('ice')).toBe(5);
		expect(cache.hashKey('jacket')).toBe(6);
		expect(cache.hashKey('grape')).toBe(7);
		expect(cache.hashKey('house')).toBe(8);
		expect(cache.hashKey('banana')).toBe(9);
	});
});
