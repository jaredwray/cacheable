import {
	calculateTtlFromExpiration,
	getCascadingTtl,
	getTtlFromExpires,
	sleep,
} from "@cacheable/utils";
import { faker } from "@faker-js/faker";
import { Keyv } from "keyv";
import { expect, test } from "vitest";
import { Cacheable } from "../src/index.js";

test("should set a value with ttl", async () => {
	const data = {
		key: faker.string.uuid(),
		value: faker.string.uuid(),
	};
	const cacheable = new Cacheable({ ttl: 100 });
	await cacheable.set(data.key, data.value);
	await sleep(150);
	const result = await cacheable.get(data.key);
	expect(result).toBeUndefined();
});

test("should set a ttl on parameter", { timeout: 2000 }, async () => {
	const cacheable = new Cacheable({ ttl: 50 });
	await cacheable.set("key", "value", 1000);
	await sleep(100);
	const result = await cacheable.get("key");
	expect(result).toEqual("value");
});

test("should get the ttl from expires", () => {
	const now = Date.now();
	const expires = now + 2000;
	const result = getTtlFromExpires(expires);
	expect(result).toBeGreaterThan(1995);
	expect(result).toBeLessThan(2005);
});

test("should get undefined when expires is undefined", () => {
	const result = getTtlFromExpires(undefined);
	expect(result).toBeUndefined();
});

test("should get undefined when expires is in the past", () => {
	const now = Date.now();
	const expires = now - 1000;
	const result = getTtlFromExpires(expires);
	expect(result).toBeUndefined();
});

test("should cascade ttl from secondary", () => {
	const result = getCascadingTtl(1000, undefined, 3000);
	expect(result).toBe(3000);
});

test("should cascade ttl from primary", () => {
	const result = getCascadingTtl(1000, 2000);
	expect(result).toBe(2000);
});

test("should cascade ttl from cacheable", () => {
	const result = getCascadingTtl(1000, undefined, undefined);
	expect(result).toBe(1000);
});

test("should cascade ttl with shorthand on cacheable", () => {
	const result = getCascadingTtl("1s", undefined, undefined);
	expect(result).toBe(1000);
});

test("should calculate and choose the ttl as it is lower", () => {
	const now = Date.now();
	const expires = now + 3000;
	const ttl = 2000;
	const result = calculateTtlFromExpiration(ttl, expires);
	expect(result).toBeLessThan(2002);
	expect(result).toBeGreaterThan(1998);
});

test("should calculate and choose the expires ttl as it is lower", () => {
	const now = Date.now();
	const expires = now + 1000;
	const ttl = 2000;
	const result = calculateTtlFromExpiration(ttl, expires);
	expect(result).toBeLessThan(1002);
	expect(result).toBeGreaterThan(998);
});

test("should calculate and choose ttl as expires is undefined", () => {
	const ttl = 2000;
	const result = calculateTtlFromExpiration(ttl, undefined);
	expect(result).toBeLessThan(2002);
	expect(result).toBeGreaterThan(1998);
});

test("should calculate and choose expires as ttl is undefined", () => {
	const now = Date.now();
	const expires = now + 1000;
	const result = calculateTtlFromExpiration(undefined, expires);
	expect(result).toBeLessThan(1002);
	expect(result).toBeGreaterThan(998);
});

test("should calculate and choose undefined as both are undefined", () => {
	const result = calculateTtlFromExpiration(undefined, undefined);
	expect(result).toBeUndefined();
});

test("should set a different ttl per store with a per-store object", {
	timeout: 2000,
}, async () => {
	const primary = new Keyv();
	const secondary = new Keyv();
	const cacheable = new Cacheable({ primary, secondary });
	await cacheable.set("key", "value", {
		ttl: { primary: 50, secondary: 500 },
	});
	expect(await primary.get("key")).toEqual("value");
	expect(await secondary.get("key")).toEqual("value");
	await sleep(120);
	// Primary has expired while the secondary still holds the value
	expect(await primary.get("key")).toBeUndefined();
	expect(await secondary.get("key")).toEqual("value");
	await sleep(450);
	expect(await secondary.get("key")).toBeUndefined();
});

test("should fall back to the store default when a per-store ttl field is omitted", {
	timeout: 3000,
}, async () => {
	const primary = new Keyv();
	const secondary = new Keyv({ ttl: 1000 });
	const cacheable = new Cacheable({ primary, secondary, ttl: 60_000 });
	await cacheable.set("key", "value", { ttl: { primary: 50 } });
	await sleep(120);
	// Primary used the explicit 50ms; secondary fell back to its own 1s default
	expect(await primary.get("key")).toBeUndefined();
	expect(await secondary.get("key")).toEqual("value");
	await sleep(1000);
	expect(await secondary.get("key")).toBeUndefined();
});

test("should apply a scalar ttl to both stores", {
	timeout: 2000,
}, async () => {
	const primary = new Keyv();
	const secondary = new Keyv();
	const cacheable = new Cacheable({ primary, secondary });
	await cacheable.set("key", "value", { ttl: 100 });
	expect(await primary.get("key")).toEqual("value");
	expect(await secondary.get("key")).toEqual("value");
	await sleep(150);
	expect(await primary.get("key")).toBeUndefined();
	expect(await secondary.get("key")).toBeUndefined();
});

test("should cap each store's per-store ttl with maxTtl", {
	timeout: 2000,
}, async () => {
	const primary = new Keyv();
	const secondary = new Keyv();
	const cacheable = new Cacheable({ primary, secondary, maxTtl: 100 });
	await cacheable.set("key", "value", {
		ttl: { primary: 50, secondary: 5000 },
	});
	await sleep(150);
	// Secondary requested 5000ms but was capped to maxTtl (100ms)
	expect(await primary.get("key")).toBeUndefined();
	expect(await secondary.get("key")).toBeUndefined();
});

test("should support a per-store ttl in getOrSet", {
	timeout: 2000,
}, async () => {
	const primary = new Keyv();
	const secondary = new Keyv();
	const cacheable = new Cacheable({ primary, secondary });
	await cacheable.getOrSet("key", async () => "value", {
		ttl: { primary: 50, secondary: 500 },
	});
	expect(await primary.get("key")).toEqual("value");
	expect(await secondary.get("key")).toEqual("value");
	await sleep(120);
	expect(await primary.get("key")).toBeUndefined();
	expect(await secondary.get("key")).toEqual("value");
});

test("should keep the tag snapshot alive for the longest-lived store copy", {
	timeout: 3000,
}, async () => {
	const primary = new Keyv();
	const secondary = new Keyv();
	const cacheable = new Cacheable({ primary, secondary, tags: true });
	// Primary outlives the secondary for this key
	await cacheable.set("key", "value", {
		ttl: { primary: 2000, secondary: 100 },
		tags: ["t1"],
	});
	await sleep(250);
	// Secondary copy has expired but the primary copy is still live
	expect(await primary.get("key")).toEqual("value");
	expect(await cacheable.get("key")).toEqual("value");
	// Invalidation must still be honored against the surviving primary copy
	await cacheable.tags.invalidateTag("t1");
	expect(await cacheable.get("key")).toBeUndefined();
});

test("should support a per-store ttl in wrap", { timeout: 3000 }, async () => {
	const primary = new Keyv();
	const secondary = new Keyv();
	const cacheable = new Cacheable({ primary, secondary });
	let calls = 0;
	const wrapped = cacheable.wrap(
		async (n: number) => {
			calls++;
			return n * 2;
		},
		{ ttl: { primary: 100, secondary: 700 } },
	);
	expect(await wrapped(5)).toEqual(10);
	expect(calls).toBe(1);
	await sleep(250);
	// Primary expired but the secondary still serves the value without re-running
	expect(await wrapped(5)).toEqual(10);
	expect(calls).toBe(1);
	await sleep(700);
	// Secondary expired too, so the function runs again
	expect(await wrapped(5)).toEqual(10);
	expect(calls).toBe(2);
});

test("treats a negative ttl as no ttl", { timeout: 2000 }, async () => {
	const cacheable = new Cacheable();
	await cacheable.set("key", "value", -5);
	await sleep(50);
	// A negative ttl is invalid, so it is treated as no ttl rather than expiring immediately
	expect(await cacheable.get("key")).toEqual("value");
});

test("treats a NaN ttl as no ttl", { timeout: 2000 }, async () => {
	const cacheable = new Cacheable();
	await cacheable.set("key", "value", Number.NaN);
	const raw = await cacheable.getRaw("key");
	expect(raw?.value).toEqual("value");
	// A NaN ttl must not produce a NaN expiry
	expect(Number.isNaN(raw?.expires)).toBe(false);
	await sleep(50);
	expect(await cacheable.get("key")).toEqual("value");
});

test("treats a negative per-store ttl field as no ttl for that store", {
	timeout: 2000,
}, async () => {
	const primary = new Keyv();
	const secondary = new Keyv();
	const cacheable = new Cacheable({ primary, secondary });
	await cacheable.set("key", "value", { ttl: { primary: -5, secondary: 100 } });
	await sleep(150);
	// Primary's negative ttl is treated as no ttl; the secondary honored its 100ms
	expect(await primary.get("key")).toEqual("value");
	expect(await secondary.get("key")).toBeUndefined();
});
