import {describe, test, expect} from 'vitest';
import {Keyv} from 'keyv';
import {KeyvCacheableMemory} from '../src/keyv-memory.js';

describe('Keyv Cacheable Memory', () => {
	test('should initialize keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		expect(keyvCacheableMemory).toBeDefined();
		const keyv = new Keyv({store: keyvCacheableMemory});
		expect(keyv).toBeDefined();
	});
	test('should set namespace for keyv cacheable memory', async () => {
		const namespace = 'ns1';
		const keyvCacheableMemory = new KeyvCacheableMemory({namespace});
		expect(keyvCacheableMemory.namespace).toBe(namespace);
		keyvCacheableMemory.namespace = 'ns2';
		expect(keyvCacheableMemory.namespace).toBe('ns2');
	});
	test('should set options for keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory({ttl: 1000, lruSize: 1000});
		expect(keyvCacheableMemory).toBeDefined();
		const keyv = new Keyv({store: keyvCacheableMemory});
		expect(keyv).toBeDefined();
	});
	test('should get undefined from keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		const value = await keyv.get('key') as string | undefined;
		expect(value).toBe(undefined);
	});
	test('should set and get value from keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		await keyv.set('key', 'value');
		const value = await keyv.get<string>('key');
		expect(value).toBe('value');
	});
	test('should delete value from keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		await keyv.set('key', 'value');
		await keyv.delete('key');
		const value = await keyv.get<string>('key');
		expect(value).toBe(undefined);
	});
	test('should clear keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		await keyv.set('key', 'value');
		await keyv.clear();
		const value = await keyv.get<string>('key');
		expect(value).toBe(undefined);
	});
	test('should check if key exists in keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		await keyv.set('key', 'value');
		const exists = await keyv.has('key');
		expect(exists).toBe(true);
	});
	test('should get many values from keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		await keyv.set('key', 'value');
		const values = await keyv.get(['key']);
		expect(values).toEqual(['value']);
	});
	test('should delete many values from keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		await keyv.set('key', 'value');
		await keyv.delete(['key']);
		const value = await keyv.get<string>('key');
		expect(value).toBe(undefined);
	});
	test('should set many values in keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		await keyvCacheableMemory.setMany([{key: 'key', value: 'value'}, {key: 'key1', value: 'value1'}]);
		const value = await keyvCacheableMemory.get('key1');
		expect(value).toBe('value1');
	});
	test('should be able to get the store based on namespace', async () => {
		const cache = new KeyvCacheableMemory();
		await cache.set('key1', 'default');
		expect(await cache.get('key1')).toBe('default');
		cache.namespace = 'ns1';
		expect(await cache.get('key1')).toBe(undefined);
		expect(cache.store.get('key1')).toBe(undefined);
		await cache.set('key1', 'ns1');
		expect(await cache.get('key1')).toBe('ns1');
		expect(cache.store.get('key1')).toBe('ns1');
		cache.namespace = undefined;
		expect(await cache.get('key1')).toBe('default');
		expect(cache.store.get('key1')).toBe('default');
	});
});
