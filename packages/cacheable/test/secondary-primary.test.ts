import {expect, test} from 'vitest';
import {Keyv} from 'keyv';
import {faker} from '@faker-js/faker';
import {Cacheable, CacheableHooks} from '../src/index.js';
import {sleep} from './sleep.js';

test('should set a new ttl when secondary is setting primary', async () => {
	const secondary = new Keyv({ttl: 100});
	const cacheable = new Cacheable({secondary});
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};
	let setItem: {key: string; value: string; ttl: number | undefined} | undefined;
	cacheable.onHook(CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY, async item => {
		setItem = item as {key: string; value: string; ttl: number | undefined};
		expect(item.key).toEqual(data.key);
		expect(item.ttl).toBeGreaterThan(98);
		expect(item.ttl).toBeLessThan(102);
		item.ttl = 1;
	});

	await cacheable.set(data.key, data.value);
	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);
	await cacheable.primary.delete(data.key);
	const result2 = await cacheable.get(data.key); // From secondary
	expect(result2).toEqual(data.value);
	await sleep(20);
	const primaryResult = await cacheable.primary.get<string>(data.key);
	expect(primaryResult).toBeUndefined();
	const secondaryResult = await cacheable.secondary?.get<string>(data.key);
	expect(secondaryResult).toEqual(data.value);
});
