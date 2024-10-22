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
	test('should return different stores for different keys starting with A to Z', () => {
		const cache = new CacheableHashStore();
		cache.set({key: 'd', value: 'value'});
		expect(cache.getStore('d').get('d')).toBeDefined();
		cache.set({key: 'ad', value: 'value'});
		expect(cache.getStore('ad').get('ad')).toBeDefined();
		cache.set({key: 'aa', value: 'value'});
		expect(cache.getStore('aa').get('aa')).toBeDefined();
		cache.set({key: 'b', value: 'value'});
		expect(cache.getStore('b').get('b')).toBeDefined();
		cache.set({key: 'abc', value: 'value'});
		expect(cache.getStore('abc').get('abc')).toBeDefined();
		cache.set({key: 'bb', value: 'value'});
		expect(cache.getStore('bb').get('bb')).toBeDefined();
		cache.set({key: 'cc', value: 'value'});
		expect(cache.getStore('cc').get('cc')).toBeDefined();
		cache.set({key: 'h', value: 'value'});
		expect(cache.getStore('h').get('h')).toBeDefined();
		cache.set({key: 'apple', value: 'value'});
		expect(cache.getStore('apple').get('apple')).toBeDefined();
		cache.set({key: 'banana', value: 'value'});
		expect(cache.getStore('banana').get('banana')).toBeDefined();
		cache.set({key: 'carrot', value: 'value'});
		expect(cache.getStore('carrot').get('carrot')).toBeDefined();
		cache.set({key: '4123', value: 'value'});
		expect(cache.getStore('4123').get('4123')).toBeDefined();
		cache.set({key: 'mouse', value: 'value'});
		expect(cache.getStore('mouse').get('mouse')).toBeDefined();
		cache.set({key: 'ice', value: 'value'});
		expect(cache.getStore('ice').get('ice')).toBeDefined();
	});
});
