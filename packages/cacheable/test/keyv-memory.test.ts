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
	test('should set options for keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory({ttl: 1000, lruSize: 1000});
		expect(keyvCacheableMemory).toBeDefined();
		const keyv = new Keyv({store: keyvCacheableMemory});
		expect(keyv).toBeDefined();
	});
	test('should set and get value from keyv cacheable memory', async () => {
		const keyvCacheableMemory = new KeyvCacheableMemory();
		const keyv = new Keyv({store: keyvCacheableMemory});
		await keyv.set('key', 'value');
		const value = await keyv.get('key');
		expect(value).toBe('value');
	});
});
