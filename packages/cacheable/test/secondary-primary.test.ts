import {expect, test} from 'vitest';
import {Keyv} from 'keyv';
import {faker} from '@faker-js/faker';
import {Cacheable, CacheableHooks} from '../src/index.js';
import {getTtlFromExpires} from '../src/ttl.js';
import {sleep} from './sleep.js';

test('should set a new ttl when secondary is setting primary', async () => {
	const secondary = new Keyv({ttl: 100});
	const cacheable = new Cacheable({secondary});
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	cacheable.onHook(CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY, async item => {
		item.ttl = 10;
	});

	await cacheable.set(data.key, data.value);
	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Remove the item from primary
	await cacheable.primary.delete(data.key);
	const primaryResult1 = await cacheable.primary.get(data.key, {raw: true});
	expect(primaryResult1).toEqual(undefined);

	// Update the item from secondary
	await cacheable.get(data.key);
	const primaryResult2 = await cacheable.primary.get(data.key, {raw: true});
	expect(primaryResult2?.value).toEqual(data.value);
	const ttlFromExpires = getTtlFromExpires(primaryResult2?.expires as number | undefined);
	expect(ttlFromExpires).toBeLessThan(12);

	// Now make sure that it expires after 10 seconds
	await sleep(20);
	const primaryResult3 = await cacheable.primary.get(data.key, {raw: true});
	expect(primaryResult3).toEqual(undefined);

	// Verify that the secondary is still there
	const secondaryResult = await cacheable.secondary?.get(data.key, {raw: true});
	expect(secondaryResult?.value).toEqual(data.value);
});

test('should use the cacheable default ttl on secondary -> primary', async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv();
	const cacheable = new Cacheable({secondary, ttl: 100});

	// Set the value on secondary with no ttl
	await cacheable.secondary?.set(data.key, data.value);

	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Get the value from primary raw to validate it has expires
	const primaryResult = await cacheable.primary.get(data.key, {raw: true});
	expect(primaryResult?.value).toEqual(data.value);
	const ttlFromExpires = getTtlFromExpires(primaryResult?.expires as number | undefined);
	expect(ttlFromExpires).toBeGreaterThan(95);
	expect(ttlFromExpires).toBeLessThan(105);
});

test('should use the primary ttl on secondary -> primary', async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv();
	const primary = new Keyv({ttl: 50});
	const cacheable = new Cacheable({secondary, primary, ttl: 100});

	// Set the value on secondary with no ttl
	await cacheable.secondary?.set(data.key, data.value);

	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Get the value from primary raw to validate it has expires
	const primaryResult = await cacheable.primary.get(data.key, {raw: true});
	expect(primaryResult?.value).toEqual(data.value);
	const ttlFromExpires = getTtlFromExpires(primaryResult?.expires as number | undefined);
	expect(ttlFromExpires).toBeGreaterThan(45);
	expect(ttlFromExpires).toBeLessThan(55);
});

test('should use the secondary ttl on secondary -> primary', async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv({ttl: 50});
	const primary = new Keyv();
	const cacheable = new Cacheable({secondary, primary, ttl: 100});

	// Set the value on secondary with no ttl
	await cacheable.secondary?.set(data.key, data.value);

	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Get the value from primary raw to validate it has expires
	const primaryResult = await cacheable.primary.get(data.key, {raw: true});
	expect(primaryResult?.value).toEqual(data.value);
	const ttlFromExpires = getTtlFromExpires(primaryResult?.expires as number | undefined);
	expect(ttlFromExpires).toBeGreaterThan(45);
	expect(ttlFromExpires).toBeLessThan(55);
});
