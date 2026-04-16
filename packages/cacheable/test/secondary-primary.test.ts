import { getTtlFromExpires, sleep } from "@cacheable/utils";
import { faker } from "@faker-js/faker";
import { Keyv } from "keyv";
import { expect, test } from "vitest";
import { Cacheable, CacheableHooks } from "../src/index.js";

test("should set a new ttl when secondary is setting primary", async () => {
	const secondary = new Keyv({ ttl: 100 });
	const cacheable = new Cacheable({ secondary });
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	cacheable.onHook(
		CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY,
		async (item) => {
			item.ttl = 10;
		},
	);

	await cacheable.set(data.key, data.value);
	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Remove the item from primary
	await cacheable.primary.delete(data.key);
	const primaryResult1 = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult1).toEqual(undefined);

	// Update the item from secondary
	await cacheable.get(data.key);
	const primaryResult2 = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult2?.value).toEqual(data.value);

	const ttlFromExpires = getTtlFromExpires(primaryResult2?.expires);
	expect(ttlFromExpires).toBeLessThan(12);

	// Now make sure that it expires after 10 seconds
	await sleep(20);
	const primaryResult3 = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult3).toEqual(undefined);

	// Verify that the secondary is still there
	const secondaryResult = await cacheable.secondary?.get(data.key, {
		raw: true,
	});
	expect(secondaryResult?.value).toEqual(data.value);
});

test("should use the cacheable default ttl on secondary -> primary", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv();
	const cacheable = new Cacheable({ secondary, ttl: 100 });

	// Set the value on secondary with no ttl
	await cacheable.secondary?.set(data.key, data.value);

	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Get the value from primary raw to validate it has expires
	const primaryResult = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult?.value).toEqual(data.value);

	const ttlFromExpires = getTtlFromExpires(primaryResult?.expires);
	expect(ttlFromExpires).toBeGreaterThan(95);
	expect(ttlFromExpires).toBeLessThan(105);
});

test("should use the primary ttl on secondary -> primary", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv();
	const primary = new Keyv({ ttl: 50 });
	const cacheable = new Cacheable({ secondary, primary, ttl: 100 });

	// Set the value on secondary with no ttl
	await cacheable.secondary?.set(data.key, data.value);

	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Get the value from primary raw to validate it has expires
	const primaryResult = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult?.value).toEqual(data.value);

	const ttlFromExpires = getTtlFromExpires(primaryResult?.expires);
	expect(ttlFromExpires).toBeGreaterThan(45);
	expect(ttlFromExpires).toBeLessThan(55);
});

test("should use the secondary ttl on secondary -> primary", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv({ ttl: 50 });
	const primary = new Keyv();
	const cacheable = new Cacheable({ secondary, primary, ttl: 100 });

	// Set the value on secondary with no ttl
	await cacheable.secondary?.set(data.key, data.value);

	const result = await cacheable.get(data.key);
	expect(result).toEqual(data.value);

	// Get the value from primary raw to validate it has expires
	const primaryResult = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult?.value).toEqual(data.value);

	const ttlFromExpires = getTtlFromExpires(primaryResult?.expires);
	expect(ttlFromExpires).toBeGreaterThan(45);
	expect(ttlFromExpires).toBeLessThan(55);
});

test("should respect per-store ttl on set when secondary has its own ttl", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv({ ttl: 500 });
	const primary = new Keyv();
	const cacheable = new Cacheable({ secondary, primary, ttl: 100 });

	// Set the value via cacheable.set (no explicit ttl)
	await cacheable.set(data.key, data.value);

	// Primary should use cacheable ttl (100ms) since it has no own ttl
	const primaryResult = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult?.value).toEqual(data.value);
	const primaryTtl = getTtlFromExpires(primaryResult?.expires);
	expect(primaryTtl).toBeGreaterThan(90);
	expect(primaryTtl).toBeLessThan(110);

	// Secondary should use its own ttl (500ms) instead of cacheable ttl (100ms)
	const secondaryResult = await cacheable.secondary?.get(data.key, {
		raw: true,
	});
	expect(secondaryResult?.value).toEqual(data.value);
	const secondaryTtl = getTtlFromExpires(secondaryResult?.expires);
	expect(secondaryTtl).toBeGreaterThan(450);
	expect(secondaryTtl).toBeLessThan(510);
});

test("should respect per-store ttl on set when primary has its own ttl", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv();
	const primary = new Keyv({ ttl: 200 });
	const cacheable = new Cacheable({ secondary, primary, ttl: 500 });

	// Set the value via cacheable.set (no explicit ttl)
	await cacheable.set(data.key, data.value);

	// Primary should use its own ttl (200ms) instead of cacheable ttl (500ms)
	const primaryResult = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult?.value).toEqual(data.value);
	const primaryTtl = getTtlFromExpires(primaryResult?.expires);
	expect(primaryTtl).toBeGreaterThan(190);
	expect(primaryTtl).toBeLessThan(210);

	// Secondary should use cacheable ttl (500ms) since it has no own ttl
	const secondaryResult = await cacheable.secondary?.get(data.key, {
		raw: true,
	});
	expect(secondaryResult?.value).toEqual(data.value);
	const secondaryTtl = getTtlFromExpires(secondaryResult?.expires);
	expect(secondaryTtl).toBeGreaterThan(490);
	expect(secondaryTtl).toBeLessThan(510);
});

test("should use explicit ttl over store and cacheable ttl", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv({ ttl: 500 });
	const primary = new Keyv({ ttl: 200 });
	const cacheable = new Cacheable({ secondary, primary, ttl: 100 });

	// Set the value with an explicit ttl of 50ms
	await cacheable.set(data.key, data.value, 50);

	// Both stores should use the explicit ttl (50ms)
	const primaryResult = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult?.value).toEqual(data.value);
	const primaryTtl = getTtlFromExpires(primaryResult?.expires);
	expect(primaryTtl).toBeGreaterThan(40);
	expect(primaryTtl).toBeLessThan(55);

	const secondaryResult = await cacheable.secondary?.get(data.key, {
		raw: true,
	});
	expect(secondaryResult?.value).toEqual(data.value);
	const secondaryTtl = getTtlFromExpires(secondaryResult?.expires);
	expect(secondaryTtl).toBeGreaterThan(40);
	expect(secondaryTtl).toBeLessThan(55);
});

test("should apply BEFORE_SET hook ttl override to both stores", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};

	const secondary = new Keyv({ ttl: 500 });
	const primary = new Keyv({ ttl: 200 });
	const cacheable = new Cacheable({ secondary, primary, ttl: 100 });

	// Hook overrides TTL to 30ms for all stores
	cacheable.onHook(CacheableHooks.BEFORE_SET, async (item) => {
		item.ttl = 30;
	});

	await cacheable.set(data.key, data.value);

	// Both stores should use the hook-overridden ttl (30ms)
	const primaryResult = await cacheable.primary.get(data.key, { raw: true });
	expect(primaryResult?.value).toEqual(data.value);
	const primaryTtl = getTtlFromExpires(primaryResult?.expires);
	expect(primaryTtl).toBeGreaterThan(20);
	expect(primaryTtl).toBeLessThan(35);

	const secondaryResult = await cacheable.secondary?.get(data.key, {
		raw: true,
	});
	expect(secondaryResult?.value).toEqual(data.value);
	const secondaryTtl = getTtlFromExpires(secondaryResult?.expires);
	expect(secondaryTtl).toBeGreaterThan(20);
	expect(secondaryTtl).toBeLessThan(35);
});
