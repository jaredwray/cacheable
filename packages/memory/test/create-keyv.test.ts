import {
	describe, test, expect,
} from 'vitest';
import {createKeyv} from '@keyv/redis';
import {createKeyv as createKeyvFromValkey} from '@keyv/valkey';
import {Cacheable} from '../src/index.js';

describe('createKeyv', () => {
	test('should be able to set secondary createKeyv from Reds', async () => {
		const secondary = createKeyv('redis://localhost:6379');
		const cacheable = new Cacheable({secondary});
		const key = 'key12345-optsec';
		expect(cacheable.primary).toBeDefined();
		const setResult = await cacheable.set(key, 'value');
		expect(setResult).toEqual(true);
		const getResult = await cacheable.get(key);
		expect(getResult).toEqual('value');
	});

	test('should be able to set secondary createKeyv from Valkey', async () => {
		const secondary = createKeyvFromValkey('redis://localhost:6379');
		const cacheable = new Cacheable({secondary});
		const key = 'key12345-optsec';
		expect(cacheable.primary).toBeDefined();
		const setResult = await cacheable.set(key, 'value');
		expect(setResult).toEqual(true);
		const getResult = await cacheable.get(key);
		expect(getResult).toEqual('value');
	});
});
