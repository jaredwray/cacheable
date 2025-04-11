import {test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {Cacheable} from '../src/index.js';
import {getTtlFromExpires, getCascadingTtl} from '../src/ttl.js';
import {sleep} from './sleep.js';

test('should set a value with ttl', async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};
	const cacheable = new Cacheable({ttl: 100});
	await cacheable.set(data.key, data.value);
	await sleep(150);
	const result = await cacheable.get(data.key);
	expect(result).toBeUndefined();
});

test('should set a ttl on parameter', {timeout: 2000}, async () => {
	const cacheable = new Cacheable({ttl: 50});
	await cacheable.set('key', 'value', 1000);
	await sleep(100);
	const result = await cacheable.get('key');
	expect(result).toEqual('value');
});

test('should get the ttl from expires', () => {
	const now = Date.now();
	const expires = now + 1000;
	const result = getTtlFromExpires(expires);
	expect(result).toBe(1000);
});

test('should get undefined when expires is undefined', () => {
	const result = getTtlFromExpires(undefined);
	expect(result).toBeUndefined();
});

test('should get undefined when expires is in the past', () => {
	const now = Date.now();
	const expires = now - 1000;
	const result = getTtlFromExpires(expires);
	expect(result).toBeUndefined();
});

test('should cascade ttl from secondary', () => {
	const result = getCascadingTtl(1000, undefined, 3000);
	expect(result).toBe(3000);
});

test('should cascade ttl from primary', () => {
	const result = getCascadingTtl(1000, 2000);
	expect(result).toBe(2000);
});

test('should cascade ttl from cacheable', () => {
	const result = getCascadingTtl(1000, undefined, undefined);
	expect(result).toBe(1000);
});

test('should cascade ttl with shorthand on cacheable', () => {
	const result = getCascadingTtl('1s', undefined, undefined);
	expect(result).toBe(1000);
});
