import {describe, test, expect} from 'vitest';
import {createWrapKey} from '../src/wrap.js';
import {CacheableMemory} from '../src/memory.js';
import {sleep} from './sleep.js';

const cacheItemList = [
	{key: 'key', value: 'value'},
	{key: 'key1', value: {foo: 'bar'}},
	{key: 'key2', value: 123, ttl: 10},
	{key: 'key3', value: [1, 2, 3]},
	{key: 'key4', value: 'value4', ttl: '5m'},
];

describe('CacheableMemory Options and Properties', () => {
	test('should have default ttl', () => {
		const cache = new CacheableMemory();
		expect(cache.ttl).toBe(undefined);
	});
	test('should be able to set ttl', () => {
		const cache = new CacheableMemory({ttl: 5});
		expect(cache.ttl).toBe(5);
		cache.ttl = 1000;
		expect(cache.ttl).toBe(1000);
	});
	test('should handle negative ttl as undefined', () => {
		const cache = new CacheableMemory({ttl: -1});
		expect(cache.ttl).toBe(undefined);
		cache.ttl = '1s';
		expect(cache.ttl).toBe('1s');
		cache.ttl = undefined;
		expect(cache.ttl).toBe(undefined);
	});
	test('should be able to get size', () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value');
		cache.set('key1', 'value');
		cache.set('key2', 'value');
		cache.set('key3', 'value');
		cache.set('key4', 'value');
		expect(cache.size).toBe(5);
	});
	test('should be able to get keys', () => {
		const cache = new CacheableMemory();
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
	test('should be able to get values', () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value');
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		cache.set('key4', 'value4');
		const values = Array.from(cache.items);
		expect(values[0].value).toBe('value3');
		expect(values[1].value).toBe('value4');
		expect(values[2].value).toBe('value1');
		expect(values[3].value).toBe('value');
		expect(values[4].value).toBe('value2');
	});
	test('should be able to set clone', () => {
		const cache = new CacheableMemory({useClone: true});
		expect(cache.useClone).toBe(true);
		cache.useClone = false;
		expect(cache.useClone).toBe(false);
	});
	test('lruSize should be 0 by default', () => {
		const cache = new CacheableMemory();
		expect(cache.lruSize).toBe(0);
	});
	test('should be able to set lruSize', () => {
		const cache = new CacheableMemory({lruSize: 15});
		expect(cache.lruSize).toBe(15);
		cache.lruSize = 5;
		expect(cache.lruSize).toBe(5);
	});
});

describe('CacheableMemory Set', async () => {
	test('should set many values', async () => {
		const cache = new CacheableMemory();
		const list = [
			{key: 'key', value: 'value'},
			{key: 'key1', value: {foo: 'bar'}},
			{key: 'key2', value: 123, ttl: 10},
			{key: 'key3', value: [1, 2, 3]},
		];
		cache.setMany(list);
		expect(cache.get('key')).toBe('value');
		expect(cache.get('key1')).toEqual({foo: 'bar'});
		expect(cache.get('key2')).toBe(123);
		expect(cache.get('key3')).toEqual([1, 2, 3]);
		await sleep(20);
		expect(cache.get('key2')).toBe(undefined);
	});
});

describe('CacheableMemory Get', async () => {
	test('should set and get value', () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value');
		expect(cache.get('key')).toBe('value');
	});
	test('should be able to get undefined value', () => {
		const cache = new CacheableMemory();
		expect(cache.get('key')).toBe(undefined);
	});
	test('should not be able to get expired value', async () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value', 1);
		await sleep(20);
		expect(cache.get('key')).toBe(undefined);
	});
	test('should not be able to get expired value with default ttl', async () => {
		const cache = new CacheableMemory({ttl: 1});
		cache.set('key', 'value');
		await sleep(20);
		expect(cache.get('key')).toBe(undefined);
	});
	test('should be able to get a clone of the value', () => {
		const cache = new CacheableMemory();
		expect(cache.useClone).toBe(true);
		cache.set('key', {value: 'value'});

		const value = cache.get('key');
		expect(value).toEqual({value: 'value'});
	});
	test('should be able to get the value without cloning', () => {
		const cache = new CacheableMemory({useClone: false});
		expect(cache.useClone).toBe(false);
		const value = {value: 'value'};
		cache.set('key', value);

		const value2 = cache.get('key');
		expect(value).toEqual(value2);
	});
	test('should be able to get many values', async () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		await sleep(20);
		const result = cache.getMany(['key', 'key1', 'key2', 'key3', 'key4']);
		expect(result[0]).toBe('value');
		expect(result[1]).toEqual({foo: 'bar'});
		expect(result[2]).toBe(undefined);
		expect(result[3]).toEqual([1, 2, 3]);
		expect(result[4]).toBe('value4');
	});
});

describe('CacheableMemory getRaw', async () => {
	test('should set and get raw value', () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value');
		expect(cache.getRaw('key')?.value).toBe('value');
	});
	test('should be able to get undefined raw value', () => {
		const cache = new CacheableMemory();
		expect(cache.getRaw('key')).toBe(undefined);
	});
	test('should not be able to get expired raw value', async () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value', 1);
		await sleep(20);
		expect(cache.getRaw('key')).toBe(undefined);
	});
	test('should be able to get many raw values', () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		const result = cache.getManyRaw(['key', 'key1', 'key2', 'key3', 'key4']);
		expect(result[0]?.value).toBe('value');
		expect(result[1]?.value).toEqual({foo: 'bar'});
		expect(result[2]?.value).toBe(123);
		expect(result[3]?.value).toEqual([1, 2, 3]);
		expect(result[4]?.value).toBe('value4');
	});
});

describe('CacheableMemory Has', async () => {
	test('should return true if key exists', () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value');
		expect(cache.has('key')).toBe(true);
	});
	test('should return false if key does not exist', () => {
		const cache = new CacheableMemory();
		expect(cache.has('key')).toBe(false);
	});
	test('should return for many keys', () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		const result = cache.hasMany(['key', 'key1', 'key2', 'key3']);
		expect(result[0]).toBe(true);
		expect(result[1]).toBe(true);
		expect(result[2]).toBe(true);
		expect(result[3]).toBe(true);
	});
});

describe('CacheableMemory Take', async () => {
	test('should set and take value', () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value');
		expect(cache.take('key')).toBe('value');
		expect(cache.get('key')).toBe(undefined);
	});
	test('should be able to take undefined value', () => {
		const cache = new CacheableMemory();
		expect(cache.take('key')).toBe(undefined);
	});
	test('should be able to take many values', () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		const result = cache.takeMany(['key', 'key1']);
		expect(result[0]).toBe('value');
		expect(result[1]).toEqual({foo: 'bar'});
		expect(cache.get('key')).toBe(undefined);
		expect(cache.get('key1')).toBe(undefined);
		expect(cache.get('key2')).toBe(123);
		expect(cache.get('key3')).toEqual([1, 2, 3]);
		expect(cache.get('key4')).toBe('value4');
	});
});

describe('CacheableMemory Delete', async () => {
	test('should set and delete value', () => {
		const cache = new CacheableMemory();
		cache.set('key', 'value');
		cache.delete('key');
		expect(cache.get('key')).toBe(undefined);
	});
	test('should be able to delete undefined value', () => {
		const cache = new CacheableMemory();
		cache.delete('key');
		expect(cache.get('key')).toBe(undefined);
	});
	test('should be able to delete many values', () => {
		const cache = new CacheableMemory();
		cache.setMany(cacheItemList);
		cache.deleteMany(['key', 'key1', 'key2', 'key3', 'key4']);
		expect(cache.get('key')).toBe(undefined);
		expect(cache.get('key1')).toBe(undefined);
		expect(cache.get('key2')).toBe(undefined);
		expect(cache.get('key3')).toBe(undefined);
		expect(cache.get('key4')).toBe(undefined);
	});
});

describe('CacheableMemory Clear', async () => {
	test('should be able to clear all values', () => {
		const cache = new CacheableMemory();
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

describe('CacheableMemory Get Store and Hash Key', async () => {
	test('should return the same store for the same key', () => {
		const cache = new CacheableMemory();
		expect(cache.getStore('key')).toBe(cache.getStore('key'));
	});
	test('should return different stores for different keys starting with A to Z', () => {
		const cache = new CacheableMemory();
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
});

describe('CacheableMemory LRU', async () => {
	test('should remove the least recently used item', () => {
		const cache = new CacheableMemory({lruSize: 3});
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		expect(cache.size).toBe(3);
		cache.set('key4', 'value4');
		expect(cache.size).toBe(3);
	});
	test('should remove the least recently used item with default lruSize', () => {
		const cache = new CacheableMemory({lruSize: 5});
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
		const item = cache.get('key7')!;
		expect(item).toBe('value7');
	});
	test('should not do anything if lruSize is 0', () => {
		const cache = new CacheableMemory({lruSize: 0});
		cache.set('key1', 'value1');
		expect(cache.lruSize).toBe(0);
		cache.lruMoveToFront('key1');
		cache.lruAddToFront('key1');
		expect(cache.size).toBe(1);
	});
	test('should not do the resize on lruSize', () => {
		const cache = new CacheableMemory({lruSize: 5});
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');
		cache.lruSize = 0;
		expect(cache.size).toBe(3);
	});
	test('should do the resize on lruSize', () => {
		const cache = new CacheableMemory({lruSize: 10});
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
describe('CacheableMemory checkInterval', () => {
	test('should be able to set the value', () => {
		const cache = new CacheableMemory({checkInterval: 1000});
		expect(cache.checkInterval).toBe(1000);
		cache.checkInterval = 500;
		expect(cache.checkInterval).toBe(500);
		cache.stopIntervalCheck();
		expect(cache.checkInterval).toBe(0);
	});
	test('should be able to check expiration on timed interval', async () => {
		const cache = new CacheableMemory({checkInterval: 10}); // 10ms
		cache.set('key1', 'value1', 1);
		cache.set('key2', 'value2', 1);
		cache.set('key3', 'value3', 1000);
		await sleep(20);
		expect(cache.get('key1')).toBe(undefined);
		expect(cache.get('key2')).toBe(undefined);
		expect(cache.get('key3')).toBe('value3');
		cache.stopIntervalCheck();
	});
});

describe('Cacheable Memory ttl parsing', () => {
	test('send in a number on ttl', () => {
		const cache = new CacheableMemory({ttl: 1000});
		expect(cache.ttl).toBe(1000);
	});
	test('send in 30s string on ttl', async () => {
		const cache = new CacheableMemory({ttl: '30ms'});
		expect(cache.ttl).toBe('30ms');
		cache.set('key', 'value');
		await sleep(40);
		expect(cache.get('key')).toBe(undefined);
	});
	test('send in 1m string on ttl', async () => {
		const cache = new CacheableMemory();
		expect(cache.ttl).toBe(undefined);
		cache.set('key', 'value', '1m');
		expect(cache.getRaw('key')?.expires).toBeGreaterThan(Date.now());
	});
	test('send in 1h string on ttl', async () => {
		const cache = new CacheableMemory();
		expect(cache.ttl).toBe(undefined);
		const datePlus45 = Date.now() + (45 * 60 * 1000);
		cache.set('key', 'value', '1h');
		expect(cache.getRaw('key')?.expires).toBeGreaterThan(datePlus45);
	});

	test('have number on default ttl and parse string on set', async () => {
		const cache = new CacheableMemory({ttl: 1000});
		expect(cache.ttl).toBe(1000);
		const datePlus45 = Date.now() + (45 * 60 * 1000);
		cache.set('key', 'value', '1h');
		expect(cache.getRaw('key')?.expires).toBeGreaterThan(datePlus45);
	});
});

describe('cacheable hash method', async () => {
	test('should hash an object', async () => {
		const cacheable = new CacheableMemory();
		const result = cacheable.hash({foo: 'bar'});
		expect(result).toEqual('7a38bf81f383f69433ad6e900d35b3e2385593f76a7b7ab5d4355b8ba41ee24b');
	});
});

describe('cacheable wrap', async () => {
	test('should wrap method with key and ttl', async () => {
		const cacheable = new CacheableMemory();
		const syncFunction = (value: number) => Math.random() * value;
		const options = {
			keyPrefix: 'prefix',
			ttl: 10,
		};

		const wrapped = cacheable.wrap(syncFunction, options);
		const result = wrapped(1);
		const result2 = wrapped(1);
		expect(result).toBe(result2);
		const cacheKey = createWrapKey(syncFunction, [1], options.keyPrefix);
		const cacheResult1 = cacheable.get<number>(cacheKey);
		expect(cacheResult1).toBe(result);
		await sleep(20);
		const cacheResult2 = cacheable.get<number>(cacheKey);
		expect(cacheResult2).toBeUndefined();
	});

	test('should wrap to default ttl', async () => {
		const cacheable = new CacheableMemory({ttl: 5});
		const asyncFunction = (value: number) => Math.random() * value;
		const options = {
			keyPrefix: 'wrapPrefix',
		};
		const wrapped = cacheable.wrap(asyncFunction, options);
		const result = wrapped(1);
		const result2 = wrapped(1);
		expect(result).toBe(result2); // Cached
		await sleep(10);
		const result3 = wrapped(1);
		expect(result3).not.toBe(result2);
	});

	test('should wrap and not expire because no ttl set at all', async () => {
		const cacheable = new CacheableMemory();
		const asyncFunction = (value: number) => Math.random() * value;
		const wrapped = cacheable.wrap(asyncFunction);
		const result = wrapped(1);
		const result2 = wrapped(1);
		expect(result).toBe(result2); // Cached
	});

	test('should be able to pass in expiration time', async () => {
		const cacheable = new CacheableMemory();
		const expire = Date.now() + 100;
		cacheable.set('key-expire1', 'value1', {expire});
		const result = cacheable.get('key-expire1');
		expect(result).toBe('value1');
		await sleep(150);
		const result2 = cacheable.get('key-expire1');
		expect(result2).toBeUndefined();
	});

	test('should be able to pass in ttl as object', async () => {
		const cacheable = new CacheableMemory();
		const ttl = '100ms';
		cacheable.set('key-expire12', 'value1', {ttl});
		const result = cacheable.get('key-expire12');
		expect(result).toBe('value1');
		await sleep(150);
		const result2 = cacheable.get('key-expire12');
		expect(result2).toBeUndefined();
	});

	test('should be able to pass in expiration time with date', async () => {
		const cacheable = new CacheableMemory();
		const expire = new Date(Date.now() + 100);
		cacheable.set('key-expire2', 'value2', {expire});
		const result = cacheable.get('key-expire2');
		expect(result).toBe('value2');
		await sleep(150);
		const result2 = cacheable.get('key-expire2');
		expect(result2).toBeUndefined();
	});
});
