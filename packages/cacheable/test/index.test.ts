import {
	vi, describe, test, expect,
} from 'vitest';
import {Keyv} from 'keyv';
import KeyvRedis from '@keyv/redis';
import {LRUCache} from 'lru-cache';
import {Cacheable, CacheableHooks} from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('cacheable options and properties', async () => {
	test('should be able to instantiate', async () => {
		const cacheable = new Cacheable();
		expect(cacheable).toBeDefined();
	});
	test('should enable nonBlocking on options', async () => {
		const cacheable = new Cacheable({nonBlocking: true});
		expect(cacheable.nonBlocking).toEqual(true);
		cacheable.nonBlocking = false;
		expect(cacheable.nonBlocking).toEqual(false);
	});
	test('should be able to set the secondary', async () => {
		const cacheable = new Cacheable({secondary: new Keyv()});
		expect(cacheable.secondary).toBeDefined();
		cacheable.secondary = new Keyv();
		expect(cacheable.secondary).toBeDefined();
	});
	test('should be able to set the primary', async () => {
		const cacheable = new Cacheable({primary: new Keyv()});
		expect(cacheable.primary).toBeDefined();
		cacheable.primary = new Keyv();
		expect(cacheable.primary).toBeDefined();
	});
	test('should be able to set a random cache instance', async () => {
		const lruOptions = {max: 100};
		const keyv = new Keyv({store: new LRUCache(lruOptions)});
		const cacheable = new Cacheable({primary: keyv});
		expect(cacheable.primary).toBeDefined();
		expect(cacheable.secondary).toBeUndefined();
		const setResult = await cacheable.set('key', 'value');
		expect(setResult).toEqual(true);
		const getResult = await cacheable.get('key');
		expect(getResult).toEqual('value');
	});
	test('should be able to set KeyvStorageAdapter', async () => {
		const keyvRedis = new KeyvRedis('redis://localhost:6379');
		const cacheable = new Cacheable({secondary: keyvRedis});
		expect(cacheable.secondary).toBeDefined();
		const setResult = await cacheable.set('key', 'value');
		expect(setResult).toEqual(true);
		const getResult = await cacheable.get('key');
		expect(getResult).toEqual('value');
		await cacheable.delete('key');
		const getResult2 = await cacheable.get('key');
		expect(getResult2).toBeUndefined();
	});
});

describe('cacheable stats', async () => {
	test('should return stats', async () => {
		const cacheable = new Cacheable();
		const stats = cacheable.stats;
		expect(stats.enabled).toBe(false);
	});
	test('shoudl be able to enable stats', async () => {
		const cacheable = new Cacheable({stats: true});
		expect(cacheable.stats.enabled).toBe(true);
		cacheable.stats.enabled = false;
		expect(cacheable.stats.enabled).toBe(false);
	});
});

describe('cacheable set method', async () => {
	test('should set a value', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		const result = await cacheable.get('key');
		expect(result).toEqual('value');
	});
	test('should throw on set', async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, 'set').mockImplementation(async () => {
			throw new Error('get error');
		});

		let result = false;
		const cacheable = new Cacheable({secondary: keyv});
		cacheable.on('error', error => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.set('key', 'value');
		expect(result).toBe(true);
	});
	test('should set a value with ttl', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value', 10);
		await sleep(20);
		const result = await cacheable.get('key');
		expect(result).toBeUndefined();
	});
	test('should handle BEFORE_SET and AFTER_SET hooks', async () => {
		const cacheable = new Cacheable();
		let beforeSet = false;
		let afterSet = false;
		cacheable.onHook(CacheableHooks.BEFORE_SET, async item => {
			beforeSet = true;
			item.value = 'new value';
		});
		cacheable.onHook(CacheableHooks.AFTER_SET, async item => {
			afterSet = true;
			expect(item.value).toEqual('new value');
		});
		await cacheable.set('key', 'value');
		expect(beforeSet).toBe(true);
		expect(afterSet).toBe(true);
	});
	test('should set the value in a non blocking way', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({nonBlocking: true, secondary});
		await cacheable.set('key', 'value');
		const result = await cacheable.get('key');
		expect(result).toEqual('value');
	});
	test('should set the value on the secondary', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({secondary});
		await cacheable.set('key', 'value');
		const result = await cacheable.get('key');
		expect(result).toEqual('value');
	});
	test('should set many values', async () => {
		const cacheable = new Cacheable();
		await cacheable.setMany([{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}]);
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual(['value1', 'value2']);
	});
	test('should set value in a non blocking way', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({nonBlocking: true, secondary});
		const result = await cacheable.set('key', 'value');
		expect(result).toEqual(true);
	});
	test('should set value in a blocking way', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({nonBlocking: false, secondary});
		const result = await cacheable.set('key', 'value');
		expect(result).toEqual(true);
	});
	test('should set many values on secondary', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({secondary});
		await cacheable.setMany([{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}]);
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual(['value1', 'value2']);
	});
	test('should set many values on secondary non blocking', async () => {
		const secondary = new Keyv();
		const nonBlocking = true;
		const cacheable = new Cacheable({nonBlocking, secondary});
		await cacheable.setMany([{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}]);
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual(['value1', 'value2']);
	});
	test('should throw on setMany', async () => {
		const cacheable = new Cacheable();
		vi.spyOn(cacheable, 'hook').mockImplementation(async () => {
			throw new Error('set error');
		});
		let result = false;
		cacheable.on('error', error => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.setMany([{key: 'key1', value: 'value1'}, {key: 'key2', value: 'value2'}]);
		expect(result).toBe(true);
	});
});

describe('cacheable get method', async () => {
	test('should get a value', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		const result = await cacheable.get('key');
		expect(result).toEqual('value');
	});
	test('should throw on get', async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, 'get').mockImplementation(async () => {
			throw new Error('get error');
		});

		let result = false;
		const cacheable = new Cacheable({secondary: keyv});
		cacheable.on('error', error => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.get('key');
		expect(result).toBe(true);
	});
	test('should handle BEFORE_GET and AFTER_GET hooks', async () => {
		const cacheable = new Cacheable();
		let beforeGet = false;
		let afterGet = false;
		cacheable.onHook(CacheableHooks.BEFORE_GET, async key => {
			beforeGet = true;
			expect(key).toEqual('key');
		});
		cacheable.onHook(CacheableHooks.AFTER_GET, async item => {
			afterGet = true;
			expect(item.key).toEqual('key');
			expect(item.result).toEqual('value');
		});
		await cacheable.set('key', 'value');
		await cacheable.get('key');
		expect(beforeGet).toBe(true);
		expect(afterGet).toBe(true);
	});
	test('should get a value from secondary', async () => {
		const keyv = new Keyv();
		await keyv.set('key', 'value');
		const cacheable = new Cacheable({secondary: keyv});
		const result = await cacheable.get('key');
		expect(result).toEqual('value');
	});
	test('should get many values', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key1', 'value1');
		await cacheable.set('key2', 'value2');
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual(['value1', 'value2']);
	});
	test('should throw on getMany', async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, 'get').mockImplementation(async () => {
			throw new Error('get error');
		});

		let result = false;
		const cacheable = new Cacheable({primary: keyv});
		cacheable.on('error', error => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.getMany(['key1', 'key2']);
		expect(result).toBe(true);
	});
	test('should get many values from secondary', async () => {
		const keyv = new Keyv();
		const cacheable = new Cacheable({secondary: keyv});
		await cacheable.secondary?.set('key1', 'value1');
		await cacheable.secondary?.set('key2', 'value2');
		const secondaryResult = await cacheable.secondary?.get(['key1', 'key2']);
		expect(secondaryResult).toEqual(['value1', 'value2']);
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual(['value1', 'value2']);
		const primaryResult = await cacheable.primary.get('key1');
		expect(primaryResult).toEqual('value1');
	});
});

describe('cacheable has method', async () => {
	test('should check if key exists and return false', async () => {
		const cacheable = new Cacheable();
		const result = await cacheable.has('key');
		expect(result).toBe(false);
	});
	test('should check if key exists and return true', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		const result = await cacheable.has('key');
		expect(result).toBe(true);
	});
	test('should check if key exists on secondary', async () => {
		const keyv = new Keyv();
		await keyv.set('key', 'value');
		const cacheable = new Cacheable({secondary: keyv});
		const result = await cacheable.has('key');
		expect(result).toBe(true);
	});
	test('should has many keys', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key1', 'value1');
		await cacheable.set('key2', 'value2');
		const result = await cacheable.hasMany(['key1', 'key2', 'key3']);
		expect(result).toEqual([true, true, false]);
	});
	test('should has many keys on secondary', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({secondary});
		await cacheable.secondary?.set('key3', 'value3');
		await cacheable.set('key1', 'value1');
		await cacheable.set('key2', 'value2');
		const result = await cacheable.hasMany(['key1', 'key2', 'key3']);
		expect(result).toEqual([true, true, true]);
	});
});

describe('cacheable delete method', async () => {
	test('should delete a key', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		await cacheable.delete('key');
		const result = await cacheable.get('key');
		expect(result).toBeUndefined();
	});
	test('should delete a key on secondary', async () => {
		const keyv = new Keyv();
		await keyv.set('key', 'value');
		const cacheable = new Cacheable({secondary: keyv});
		await cacheable.delete('key');
		const result = await cacheable.get('key');
		expect(result).toBeUndefined();
	});
	test('should delete keys non blocking', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({nonBlocking: true, secondary});
		await cacheable.set('key', 'value');
		await cacheable.delete('key');
		const result = await cacheable.get('key');
		expect(result).toBeUndefined();
	});
	test('should delete many keys', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key1', 'value1');
		await cacheable.set('key2', 'value2');
		await cacheable.deleteMany(['key1', 'key2']);
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual([undefined, undefined]);
	});
	test('should delete many keys on secondary', async () => {
		const keyv = new Keyv();
		const cacheable = new Cacheable({secondary: keyv});
		await cacheable.set('key1', 'value1');
		await cacheable.set('key2', 'value2');
		await cacheable.deleteMany(['key1', 'key2']);
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual([undefined, undefined]);
	});
	test('should delete many keys on secondary non blocking', async () => {
		const keyv = new Keyv();
		const nonBlocking = true;
		const cacheable = new Cacheable({nonBlocking, secondary: keyv});
		await cacheable.set('key1', 'value1');
		await cacheable.set('key2', 'value2');
		await cacheable.deleteMany(['key1', 'key2']);
		const result = await cacheable.getMany(['key1', 'key2']);
		expect(result).toEqual([undefined, undefined]);
	});
});

describe('cacheable take method', async () => {
	test('should take a value', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		const result = await cacheable.take('key');
		expect(result).toEqual('value');
		const result2 = await cacheable.get('key');
		expect(result2).toBeUndefined();
	});
	test('should take many values', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key1', 'value1');
		await cacheable.set('key2', 'value2');
		const result = await cacheable.takeMany(['key1', 'key2']);
		expect(result).toEqual(['value1', 'value2']);
		const result2 = await cacheable.getMany(['key1', 'key2']);
		expect(result2).toEqual([undefined, undefined]);
	});
});

describe('cacheable clear method', async () => {
	test('should clear the cache', async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({secondary});
		await cacheable.set('key', 'value');
		await cacheable.clear();
		const result = await cacheable.get('key');
		expect(result).toBeUndefined();
	});
	test('should clear the cache', async () => {
		const secondary = new Keyv();
		const nonBlocking = true;
		const cacheable = new Cacheable({nonBlocking, secondary});
		await cacheable.set('key', 'value');
		await cacheable.clear();
		const result = await cacheable.get('key');
		expect(result).toBeUndefined();
	});
});

describe('cacheable disconnect method', async () => {
	test('should disconnect the cache', async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		let primaryDisconnected = false;
		let secondaryDisconnected = false;
		vi.spyOn(primary, 'disconnect').mockImplementation(async () => {
			primaryDisconnected = true;
		});
		vi.spyOn(secondary, 'disconnect').mockImplementation(async () => {
			secondaryDisconnected = true;
		});
		const cacheable = new Cacheable({primary, secondary});
		await cacheable.disconnect();
		expect(primaryDisconnected).toBe(true);
		expect(secondaryDisconnected).toBe(true);
	});
	test('should disconnect the cache non blocking', async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const nonBlocking = true;
		let primaryDisconnected = false;
		let secondaryDisconnected = false;
		vi.spyOn(primary, 'disconnect').mockImplementation(async () => {
			primaryDisconnected = true;
		});
		vi.spyOn(secondary, 'disconnect').mockImplementation(async () => {
			secondaryDisconnected = true;
		});
		const cacheable = new Cacheable({nonBlocking, primary, secondary});
		await cacheable.disconnect();
		expect(primaryDisconnected).toBe(true);
		expect(secondaryDisconnected).toBe(true);
	});
});
