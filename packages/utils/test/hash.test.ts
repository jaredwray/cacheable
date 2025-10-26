import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";
import { HashAlgorithm, hash, hashToNumber } from "../src/hash.js";

describe("hash", () => {
	test("hashes an object using the specified algorithm", () => {
		// Arrange
		const object = { foo: "bar" };
		const algorithm = HashAlgorithm.SHA256;

		// Act
		const result = hash(object, { algorithm });

		// Assert
		expect(result).toBe(
			"7a38bf81f383f69433ad6e900d35b3e2385593f76a7b7ab5d4355b8ba41ee24b",
		);
	});
	test("hashes a string using the default algorithm", () => {
		// Arrange
		const object = "foo";

		// Act
		const result = hash(object);

		// Assert
		expect(result).toBe(
			"b2213295d564916f89a6a42455567c87c3f480fcd7a1c15e220f17d7169a790b",
		);
	});

	test("hashes a number using the default algorithm", () => {
		// Arrange
		const object = "123";

		// Act
		const result = hashToNumber(object);

		// Assert
		expect(result).toBeDefined();
	});

	test("throws an error when the algorithm is not supported", () => {
		// @ts-expect-error testing unsupported algorithm
		expect(() => hash("foo", "md5foo")).toThrowError(
			"Cannot create property 'algorithm' on string 'md5foo'",
		);
	});

	test("throws an error when a valid but unsupported hash algorithm is provided", () => {
		// Test the actual unsupported algorithm error path
		// @ts-expect-error testing unsupported algorithm string
		expect(() => hash("foo", { algorithm: "invalidalgo" })).toThrowError(
			"Unsupported hash algorithm: 'invalidalgo'",
		);
	});

	test("hashes an object using the DJB2 algorithm", () => {
		// Arrange
		const object = { foo: "bar" };
		const algorithm = HashAlgorithm.DJB2;

		// Act
		const result = hash(object, { algorithm });

		// Assert
		expect(result).toBe("717564430");
	});

	test("hashToNumber returns a number within the specified range", () => {
		// Arrange
		const min = 0;
		const max = 10;

		// Act
		const result = hashToNumber(
			{ foo: "bar" },
			{ min, max, algorithm: HashAlgorithm.DJB2 },
		);

		// Assert
		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});

	test("hashToNumber the same number for the same object", () => {
		// Arrange
		const min = 0;
		const max = 10;

		const value = faker.string.alphanumeric(10);

		// Act
		const result = hashToNumber(
			{ foo: value },
			{ min, max, algorithm: HashAlgorithm.DJB2 },
		);
		const result2 = hashToNumber(
			{ foo: value },
			{ min, max, algorithm: HashAlgorithm.DJB2 },
		);

		// Assert
		expect(result).toBe(result2);
	});

	test("hashToNumber the same number for the same object with djb2", () => {
		// Arrange
		const min = 0;
		const max = 10;

		const data = Array.from({ length: 500 }, () => ({
			key: faker.string.uuid(),
			value: faker.string.alphanumeric(10),
		}));
		let outOfRange = false;

		for (const item of data) {
			const result = hashToNumber(item, {
				min,
				max,
				algorithm: HashAlgorithm.DJB2,
			});
			expect(result).toBeGreaterThanOrEqual(min);
			expect(result).toBeLessThanOrEqual(max);
			if (result > max || result < min) {
				outOfRange = true;
			}
		}

		// Assert
		expect(outOfRange).toBe(false);
	});

	test("hashToNumber throws error when min >= max", () => {
		// Arrange
		const min = 10;
		const max = 5; // Invalid: min >= max

		// Act & Assert
		expect(() => hashToNumber("test", { min, max })).toThrowError(
			"Invalid range: min (10) must be less than max (5)",
		);
	});

	test("hashToNumber throws error when min equals max", () => {
		// Arrange
		const min = 5;
		const max = 5; // Invalid: min == max

		// Act & Assert
		expect(() => hashToNumber("test", { min, max })).toThrowError(
			"Invalid range: min (5) must be less than max (5)",
		);
	});

	test("hashToNumber uses default algorithm when not provided", () => {
		// Arrange & Act
		const result = hashToNumber("test", { min: 0, max: 10 });

		// Assert - should work without specifying algorithm
		expect(result).toBeDefined();
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber uses default stringify when not provided", () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = hashToNumber(object, { min: 0, max: 10 });

		// Assert - should work without specifying stringify
		expect(result).toBeDefined();
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hash uses default algorithm when not provided", () => {
		// Arrange
		const object = "test";

		// Act
		const result = hash(object, {});

		// Assert - should work without specifying algorithm
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
	});

	test("hash uses default stringify when not provided", () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = hash(object, {});

		// Assert - should work without specifying stringify
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
	});

	test("hashToNumber uses default min when min is undefined", () => {
		// Arrange & Act
		const result = hashToNumber("test", { min: undefined, max: 10 });

		// Assert - should use default min value of 0
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber uses default max when max is undefined", () => {
		// Arrange & Act
		const result = hashToNumber("test", { min: 0, max: undefined });

		// Assert - should use default max value of 10
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber uses both default min and max when both are undefined", () => {
		// Arrange & Act
		const result = hashToNumber("test", { min: undefined, max: undefined });

		// Assert - should use default range 0-10
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber handles edge case with very large hash numbers", () => {
		// Test with large range to exercise edge cases
		const min = 0;
		const max = Number.MAX_SAFE_INTEGER;

		// Act
		const result = hashToNumber("test", { min, max });

		// Assert - should still be within range
		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});

	test("hashToNumber with all hash algorithms stays within range", () => {
		// Test all algorithms to ensure proper range handling
		const testData = "test data";
		const min = 0;
		const max = 100;

		for (const algorithm of Object.values(HashAlgorithm)) {
			const result = hashToNumber(testData, { min, max, algorithm });
			expect(result).toBeGreaterThanOrEqual(min);
			expect(result).toBeLessThanOrEqual(max);
		}
	});

	test("hashToNumber handles potential integer overflow scenarios", () => {
		// Test with different combinations that could stress the math
		const testCases = [
			{ min: -1000, max: 1000 },
			{ min: 1, max: 2 },
			{ min: 0, max: 1 },
			{ min: -100, max: -50 },
			{ min: Number.MIN_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER + 100 },
		];

		for (const { min, max } of testCases) {
			const result = hashToNumber("edge case test", { min, max });
			expect(result).toBeGreaterThanOrEqual(min);
			expect(result).toBeLessThanOrEqual(max);
		}
	});

	test("hashToNumber with custom serialize function that returns edge case strings", () => {
		// Test with a custom serializer that could produce edge cases
		const customSerialize = () => "z".repeat(1000); // Very large string to hash
		const min = 0;
		const max = 10;

		const result = hashToNumber("test", {
			min,
			max,
			serialize: customSerialize,
		});

		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});

	test("hashToNumber comprehensively tests range boundaries", () => {
		// Generate many test cases to ensure all boundary conditions work
		const testCases = Array.from({ length: 1000 }, () => ({
			data: faker.string.alphanumeric(faker.number.int({ min: 1, max: 100 })),
			min: faker.number.int({ min: -1000, max: 0 }),
			max: faker.number.int({ min: 1, max: 1000 }),
		}));

		for (const { data, min, max } of testCases) {
			const result = hashToNumber(data, { min, max });
			expect(result).toBeGreaterThanOrEqual(min);
			expect(result).toBeLessThanOrEqual(max);
		}
	});
});
