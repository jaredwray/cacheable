import {test, expect} from 'vitest';
import {faker} from '@faker-js/faker';
import {Cacheable} from '../src/index.js';
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
