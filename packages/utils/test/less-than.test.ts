import { describe, expect, test } from "vitest";
import { lessThan } from "../src/less-than.js";

describe("lessThan", () => {
	test("returns true when first number is less than second number", () => {
		// Arrange & Act & Assert
		expect(lessThan(1, 2)).toBe(true);
		expect(lessThan(0, 1)).toBe(true);
		expect(lessThan(-1, 0)).toBe(true);
		expect(lessThan(-2, -1)).toBe(true);
		expect(lessThan(1.5, 2.5)).toBe(true);
		expect(lessThan(-10, 10)).toBe(true);
	});

	test("returns false when first number is greater than second number", () => {
		// Arrange & Act & Assert
		expect(lessThan(2, 1)).toBe(false);
		expect(lessThan(1, 0)).toBe(false);
		expect(lessThan(0, -1)).toBe(false);
		expect(lessThan(-1, -2)).toBe(false);
		expect(lessThan(2.5, 1.5)).toBe(false);
		expect(lessThan(10, -10)).toBe(false);
	});

	test("returns false when both numbers are equal", () => {
		// Arrange & Act & Assert
		expect(lessThan(1, 1)).toBe(false);
		expect(lessThan(0, 0)).toBe(false);
		expect(lessThan(-1, -1)).toBe(false);
		expect(lessThan(1.5, 1.5)).toBe(false);
	});

	test("returns false when first parameter is not a number", () => {
		// Arrange & Act & Assert
		expect(lessThan(undefined, 1)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan("1", 2)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(null, 1)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(true, 1)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan({}, 1)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan([], 1)).toBe(false);
		expect(lessThan(Number.NaN, 1)).toBe(false);
	});

	test("returns false when second parameter is not a number", () => {
		// Arrange & Act & Assert
		expect(lessThan(1, undefined)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(1, "2")).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(1, null)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(1, true)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(1, {})).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(1, [])).toBe(false);
		expect(lessThan(1, Number.NaN)).toBe(false);
	});

	test("returns false when both parameters are not numbers", () => {
		// Arrange & Act & Assert
		expect(lessThan(undefined, undefined)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan("1", "2")).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(null, null)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan(true, false)).toBe(false);
		// @ts-expect-error testing non-number types
		expect(lessThan({}, [])).toBe(false);
		expect(lessThan(Number.NaN, Number.NaN)).toBe(false);
	});

	test("returns false when no parameters are provided", () => {
		// Arrange & Act & Assert
		expect(lessThan()).toBe(false);
	});

	test("returns false with edge case numbers", () => {
		// Arrange & Act & Assert
		expect(lessThan(Number.POSITIVE_INFINITY, 1)).toBe(false);
		expect(lessThan(1, Number.POSITIVE_INFINITY)).toBe(true);
		expect(lessThan(Number.NEGATIVE_INFINITY, 1)).toBe(true);
		expect(lessThan(1, Number.NEGATIVE_INFINITY)).toBe(false);
		expect(lessThan(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(
			false,
		);
		expect(lessThan(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)).toBe(
			false,
		);
		expect(lessThan(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)).toBe(
			false,
		);
		expect(lessThan(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(
			true,
		);
	});
});
