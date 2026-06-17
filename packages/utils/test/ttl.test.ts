import { describe, expect, test } from "vitest";
import {
	calculateTtlFromExpiration,
	getCascadingTtl,
	getTtlFromExpires,
	resolvePerStoreTtl,
} from "../src/ttl.js";

describe("TTL utilities", () => {
	test("getTtlFromExpires should return undefined for invalid expires", () => {
		expect(getTtlFromExpires(undefined)).toBeUndefined();
		expect(getTtlFromExpires(Date.now() - 1000)).toBeUndefined();
	});

	test("getTtlFromExpires should return correct TTL", () => {
		const expires = Date.now() + 5000; // 5 seconds in the future
		expect(getTtlFromExpires(expires)).toBeCloseTo(5000, -2);
	});

	test("getCascadingTtl should return secondaryTtl if defined", () => {
		expect(getCascadingTtl(undefined, undefined, 3000)).toBe(3000);
	});

	test("getCascadingTtl should return primaryTtl if secondary is undefined", () => {
		expect(getCascadingTtl(undefined, 2000, undefined)).toBe(2000);
	});

	test("getCascadingTtl should return cacheableTtl if both primary and secondary are undefined", () => {
		expect(getCascadingTtl("5s")).toBeCloseTo(5000, -2);
	});

	test("calculateTtlFromExpiration should handle undefined ttl and expires", () => {
		expect(calculateTtlFromExpiration(undefined, undefined)).toBeUndefined();
	});

	test("calculateTtlFromExpiration should return ttl if expires is undefined", () => {
		const ttl = 3000;
		expect(calculateTtlFromExpiration(ttl, undefined)).toBe(ttl);
	});

	test("calculateTtlFromExpiration should return expires if ttl is undefined", () => {
		const expires = Date.now() + 4000;
		expect(calculateTtlFromExpiration(undefined, expires)).toBeCloseTo(
			4000,
			-2,
		);
	});

	test("calculateTtlFromExpiration should return the smaller of ttl and expires", async () => {
		const ttl = 2000;
		const expires = Date.now() + 3000;
		expect(calculateTtlFromExpiration(ttl, expires)).toBeCloseTo(ttl, -2);
	});

	test("calculateTtlFromExpiration should return the expires", async () => {
		const ttl = 5000;
		const expires = Date.now() + 2000;
		expect(calculateTtlFromExpiration(ttl, expires)).toBeCloseTo(2000, -2);
	});

	test("resolvePerStoreTtl should apply a number to both stores", () => {
		expect(resolvePerStoreTtl(5000)).toEqual({
			primary: 5000,
			secondary: 5000,
		});
	});

	test("resolvePerStoreTtl should apply a shorthand string to both stores", () => {
		expect(resolvePerStoreTtl("5s")).toEqual({
			primary: 5000,
			secondary: 5000,
		});
	});

	test("resolvePerStoreTtl should resolve undefined to both stores", () => {
		expect(resolvePerStoreTtl()).toEqual({
			primary: undefined,
			secondary: undefined,
		});
	});

	test("resolvePerStoreTtl should resolve null to both stores", () => {
		expect(resolvePerStoreTtl(null as unknown as undefined)).toEqual({
			primary: undefined,
			secondary: undefined,
		});
	});

	test("resolvePerStoreTtl should resolve per-store object fields independently", () => {
		expect(resolvePerStoreTtl({ primary: "1s", secondary: 60_000 })).toEqual({
			primary: 1000,
			secondary: 60_000,
		});
	});

	test("resolvePerStoreTtl should leave undefined per-store fields undefined", () => {
		expect(resolvePerStoreTtl({ primary: "10s" })).toEqual({
			primary: 10_000,
			secondary: undefined,
		});
		expect(resolvePerStoreTtl({ secondary: "10s" })).toEqual({
			primary: undefined,
			secondary: 10_000,
		});
	});
});
