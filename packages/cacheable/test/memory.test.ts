import {describe, test, expect} from 'vitest';
import {CacheableInMemory} from '../src/memory.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('CacheableInMemory Options and Properties', () => {
	test('should have default ttl', () => {
		const cache = new CacheableInMemory();
		expect(cache.ttl).toBe(0);
	});
	test('should be able to set ttl', () => {
		const cache = new CacheableInMemory({ttl: 5});
		expect(cache.ttl).toBe(5);
		cache.ttl = 1000;
		expect(cache.ttl).toBe(1000);
	});
	test('should be able to get size', () => {
		const cache = new CacheableInMemory();
		cache.set('key', 'value');
		cache.set('key1', 'value');
		cache.set('key2', 'value');
		cache.set('key3', 'value');
		cache.set('key4', 'value');
		expect(cache.size).toBe(5);
	});
	test('should be able to get keys', () => {
		const cache = new CacheableInMemory();
		cache.set('key', 'value');
		cache.set('key1', 'value');
		cache.set('key2', 'value');
		cache.set('key3', 'value');
		cache.set('key4', 'value');
		const keys = Array.from(cache.keys);
		expect(keys).toContain('key');
		expect(keys).toContain('key1');
		expect(keys).toContain('key2');
		expect(keys).toContain('key3');
		expect(keys).toContain('key4');
	});
	test('should be able to set clone', () => {
		const cache = new CacheableInMemory({useClone: true});
		expect(cache.useClone).toBe(true);
		cache.useClone = false;
		expect(cache.useClone).toBe(false);
	});
	test('lruSize should be 0 by default', () => {
		const cache = new CacheableInMemory();
		expect(cache.lruSize).toBe(0);
	});
	test('should be able to set lruSize', () => {
		const cache = new CacheableInMemory({lruSize: 15});
		expect(cache.lruSize).toBe(15);
		cache.lruSize = 5;
		expect(cache.lruSize).toBe(5);
	});
});

describe('CacheableInMemory Get', async () => {
	test('should set and get value', () => {
		const cache = new CacheableInMemory();
		cache.set('key', 'value');
		expect(cache.get('key')).toBe('value');
	});
	test('should be able to get undefined value', () => {
		const cache = new CacheableInMemory();
		expect(cache.get('key')).toBe(undefined);
	});
	test('should not be able to get expired value', async () => {
		const cache = new CacheableInMemory();
		cache.set('key', 'value', 1);
		await sleep(20);
		expect(cache.get('key')).toBe(undefined);
	});
	test('should not be able to get expired value with default ttl', async () => {
		const cache = new CacheableInMemory({ttl: 1});
		cache.set('key', 'value');
		await sleep(20);
		expect(cache.get('key')).toBe(undefined);
	});
	test('should be able to get a clone of the value', () => {
		const cache = new CacheableInMemory();
		expect(cache.useClone).toBe(true);
		cache.set('key', {value: 'value'});
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const value = cache.get('key');
		expect(value).toEqual({value: 'value'});
	});
	test('should be able to get the value without cloning', () => {
		const cache = new CacheableInMemory({useClone: false});
		expect(cache.useClone).toBe(false);
		const value = {value: 'value'};
		cache.set('key', value);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const value2 = cache.get('key');
		expect(value).toEqual(value2);
	});
});

describe('CacheableInMemory Has', async () => {
	test('should return true if key exists', () => {
		const cache = new CacheableInMemory();
		cache.set('key', 'value');
		expect(cache.has('key')).toBe(true);
	});
	test('should return false if key does not exist', () => {
		const cache = new CacheableInMemory();
		expect(cache.has('key')).toBe(false);
	});
});

describe('CacheableInMemory Take', async () => {
	test('should set and take value', () => {
		const cache = new CacheableInMemory();
		cache.set('key', 'value');
		expect(cache.take('key')).toBe('value');
		expect(cache.get('key')).toBe(undefined);
	});
	test('should be able to take undefined value', () => {
		const cache = new CacheableInMemory();
		expect(cache.take('key')).toBe(undefined);
	});
});

describe('CacheableInMemory Delete', async () => {
	test('should set and delete value', () => {
		const cache = new CacheableInMemory();
		cache.set('key', 'value');
		cache.delete('key');
		expect(cache.get('key')).toBe(undefined);
	});
	test('should be able to delete undefined value', () => {
		const cache = new CacheableInMemory();
		cache.delete('key');
		expect(cache.get('key')).toBe(undefined);
	});
});

describe('CacheableInMemory Clear', async () => {
	test('should be able to clear all values', () => {
		const cache = new CacheableInMemory();
		cache.set('key1', 'value1');
		cache.set('foo', 'value2');
		cache.set('arch', 'value2');
		cache.set('linux', 'value2');
		cache.set('windows', 'value2');
		cache.clear();
		expect(cache.get('key1')).toBe(undefined);
		expect(cache.get('foo')).toBe(undefined);
	});
});

describe('CacheableInMemory Get Store and Hash Key', async () => {
	test('should return the same store for the same key', () => {
		const cache = new CacheableInMemory();
		expect(cache.getStore('key')).toBe(cache.getStore('key'));
	});
	test('should return different stores for different keys starting with A to Z', () => {
		const cache = new CacheableInMemory();
		cache.set('d', 'value');
		expect(cache.getStore('d').get('d')).toBeDefined();
		cache.set('ad', 'value');
		expect(cache.getStore('ad').get('ad')).toBeDefined();
		cache.set('aa', 'value');
		expect(cache.getStore('aa').get('aa')).toBeDefined();
		cache.set('b', 'value');
		expect(cache.getStore('b').get('b')).toBeDefined();
		cache.set('abc', 'value');
		expect(cache.getStore('abc').get('abc')).toBeDefined();
		cache.set('bb', 'value');
		expect(cache.getStore('bb').get('bb')).toBeDefined();
		cache.set('cc', 'value');
		expect(cache.getStore('cc').get('cc')).toBeDefined();
		cache.set('h', 'value');
		expect(cache.getStore('h').get('h')).toBeDefined();
		cache.set('apple', 'value');
		expect(cache.getStore('apple').get('apple')).toBeDefined();
		cache.set('banana', 'value');
		expect(cache.getStore('banana').get('banana')).toBeDefined();
		cache.set('carrot', 'value');
		expect(cache.getStore('carrot').get('carrot')).toBeDefined();
		cache.set('4123', 'value');
		expect(cache.getStore('4123').get('4123')).toBeDefined();
		cache.set('mouse', 'value');
		expect(cache.getStore('mouse').get('mouse')).toBeDefined();
		cache.set('ice', 'value');
		expect(cache.getStore('ice').get('ice')).toBeDefined();
	});
	test('hash key should be the correct number', () => {
		const cache = new CacheableInMemory();
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

describe('CacheableInMemory LRU', async () => {
	test('should remove the least recently used item', () => {
		const cache = new CacheableInMemory({lruSize: 3});
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		expect(cache.size).toBe(3);
		cache.set('key4', 'value4');
		expect(cache.size).toBe(3);
	});
	test('should remove the least recently used item with default lruSize', () => {
		const cache = new CacheableInMemory({lruSize: 5});
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		cache.set('key4', 'value4');
		cache.set('key5', 'value5');
		cache.get('key1');
		cache.get('key2');
		cache.get('key3');
		cache.set('key4', 'value4');
		expect(cache.size).toBe(5);
		cache.set('key6', 'value6');
		cache.set('key7', 'value7');
		expect(cache.size).toBe(5);
		const item = cache.get('key7') as string;
		expect(item).toBe('value7');
	});
	test('should not do anything if lruSize is 0', () => {
		const cache = new CacheableInMemory({lruSize: 0});
		cache.set('key1', 'value1');
		expect(cache.lruSize).toBe(0);
		cache.lruMoveToFront('key1');
		cache.lruAddToFront('key1');
		expect(cache.size).toBe(1);
	});
	test('should not do the resize on lruSize', () => {
		const cache = new CacheableInMemory({lruSize: 5});
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		cache.lruSize = 0;
		expect(cache.size).toBe(3);
	});
	test('should do the resize on lruSize', () => {
		const cache = new CacheableInMemory({lruSize: 10});
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		cache.set('key4', 'value4');
		cache.set('key5', 'value5');
		cache.set('key6', 'value6');
		cache.set('key7', 'value7');
		cache.set('key8', 'value8');
		cache.set('key9', 'value9');
		cache.set('key10', 'value10');
		expect(cache.size).toBe(10);
		cache.lruSize = 5;
		expect(cache.size).toBe(5);
	});
});
