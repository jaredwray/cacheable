import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";
import {
	HashAlgorithm,
	hash,
	hashSync,
	hashToNumber,
	hashToNumberSync,
} from "../src/hash.js";

describe("hash (async - cryptographic algorithms)", () => {
	test("hashes an object using SHA-256 algorithm", async () => {
		// Arrange
		const object = { foo: "bar" };
		const algorithm = HashAlgorithm.SHA256;

		// Act
		const result = await hash(object, { algorithm });

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hashes a string using the default algorithm (SHA-256)", async () => {
		// Arrange
		const object = "foo";

		// Act
		const result = await hash(object);

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hashes consistently produce the same output for the same input", async () => {
		// Arrange
		const object = { foo: "bar", baz: 123 };

		// Act
		const result1 = await hash(object);
		const result2 = await hash(object);

		// Assert
		expect(result1).toBe(result2);
	});

	test("hash uses default algorithm when not provided", async () => {
		// Arrange
		const object = "test";

		// Act
		const result = await hash(object, {});

		// Assert - should work without specifying algorithm
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
	});

	test("hash uses default serialize when not provided", async () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = await hash(object, {});

		// Assert - should work without specifying serialize
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
	});

	test("hash works with SHA-384 algorithm", async () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = await hash(object, { algorithm: HashAlgorithm.SHA384 });

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hash works with SHA-512 algorithm", async () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = await hash(object, { algorithm: HashAlgorithm.SHA512 });

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hash with custom serialize function", async () => {
		// Arrange
		const object = { foo: "bar" };
		const customSerialize = (obj: unknown) => `custom:${JSON.stringify(obj)}`;

		// Act
		const result1 = await hash(object, { serialize: customSerialize });
		const result2 = await hash(object, { serialize: JSON.stringify });

		// Assert
		expect(result1).not.toBe(result2);
		expect(result1).toBeDefined();
		expect(result2).toBeDefined();
	});
});

describe("hashSync (sync - non-cryptographic algorithms)", () => {
	test("hashes an object using DJB2 algorithm", () => {
		// Arrange
		const object = { foo: "bar" };
		const algorithm = HashAlgorithm.DJB2;

		// Act
		const result = hashSync(object, { algorithm });

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hashes a string using the default sync algorithm (DJB2)", () => {
		// Arrange
		const object = "foo";

		// Act
		const result = hashSync(object);

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
	});

	test("hashSync produces consistent output for the same input", () => {
		// Arrange
		const object = { foo: "bar", baz: 123 };

		// Act
		const result1 = hashSync(object);
		const result2 = hashSync(object);

		// Assert
		expect(result1).toBe(result2);
	});

	test("hashSync works with FNV1 algorithm", () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = hashSync(object, { algorithm: HashAlgorithm.FNV1 });

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hashSync works with MURMER algorithm", () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = hashSync(object, { algorithm: HashAlgorithm.MURMER });

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hashSync works with CRC32 algorithm", () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = hashSync(object, { algorithm: HashAlgorithm.CRC32 });

		// Assert
		expect(result).toBeDefined();
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	test("hashSync with custom serialize function", () => {
		// Arrange
		const object = { foo: "bar" };
		const customSerialize = (obj: unknown) => `custom:${JSON.stringify(obj)}`;

		// Act
		const result1 = hashSync(object, { serialize: customSerialize });
		const result2 = hashSync(object, { serialize: JSON.stringify });

		// Assert
		expect(result1).not.toBe(result2);
		expect(result1).toBeDefined();
		expect(result2).toBeDefined();
	});
});

describe("hashToNumber (async - cryptographic algorithms)", () => {
	test("hashToNumber returns a number within the specified range", async () => {
		// Arrange
		const min = 0;
		const max = 10;

		// Act
		const result = await hashToNumber(
			{ foo: "bar" },
			{ min, max, algorithm: HashAlgorithm.SHA256 },
		);

		// Assert
		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});

	test("hashToNumber returns the same number for the same object", async () => {
		// Arrange
		const min = 0;
		const max = 10;
		const value = faker.string.alphanumeric(10);

		// Act
		const result = await hashToNumber(
			{ foo: value },
			{ min, max, algorithm: HashAlgorithm.SHA256 },
		);
		const result2 = await hashToNumber(
			{ foo: value },
			{ min, max, algorithm: HashAlgorithm.SHA256 },
		);

		// Assert
		expect(result).toBe(result2);
	});

	test("hashToNumber throws error when min >= max", async () => {
		// Arrange
		const min = 10;
		const max = 5;

		// Act & Assert
		await expect(hashToNumber("test", { min, max })).rejects.toThrowError(
			"Invalid range: min (10) must be less than max (5)",
		);
	});

	test("hashToNumber throws error when min equals max", async () => {
		// Arrange
		const min = 5;
		const max = 5;

		// Act & Assert
		await expect(hashToNumber("test", { min, max })).rejects.toThrowError(
			"Invalid range: min (5) must be less than max (5)",
		);
	});

	test("hashToNumber uses default algorithm when not provided", async () => {
		// Arrange & Act
		const result = await hashToNumber("test", { min: 0, max: 10 });

		// Assert
		expect(result).toBeDefined();
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber uses default serialize when not provided", async () => {
		// Arrange
		const object = { foo: "bar" };

		// Act
		const result = await hashToNumber(object, { min: 0, max: 10 });

		// Assert
		expect(result).toBeDefined();
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber uses default min when min is undefined", async () => {
		// Arrange & Act
		const result = await hashToNumber("test", { min: undefined, max: 10 });

		// Assert
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber uses default max when max is undefined", async () => {
		// Arrange & Act
		const result = await hashToNumber("test", { min: 0, max: undefined });

		// Assert
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber uses both default min and max when both are undefined", async () => {
		// Arrange & Act
		const result = await hashToNumber("test", {
			min: undefined,
			max: undefined,
		});

		// Assert
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumber handles edge case with very large hash numbers", async () => {
		// Test with large range
		const min = 0;
		const max = Number.MAX_SAFE_INTEGER;

		// Act
		const result = await hashToNumber("test", { min, max });

		// Assert
		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});

	test("hashToNumber with custom serialize function", async () => {
		// Test with a custom serializer
		const customSerialize = () => "z".repeat(1000);
		const min = 0;
		const max = 10;

		const result = await hashToNumber("test", {
			min,
			max,
			serialize: customSerialize,
		});

		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});
});

describe("hashToNumberSync (sync - non-cryptographic algorithms)", () => {
	test("hashToNumberSync returns a number within the specified range", () => {
		// Arrange
		const min = 0;
		const max = 10;

		// Act
		const result = hashToNumberSync(
			{ foo: "bar" },
			{ min, max, algorithm: HashAlgorithm.DJB2 },
		);

		// Assert
		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});

	test("hashToNumberSync returns the same number for the same object", () => {
		// Arrange
		const min = 0;
		const max = 10;
		const value = faker.string.alphanumeric(10);

		// Act
		const result = hashToNumberSync(
			{ foo: value },
			{ min, max, algorithm: HashAlgorithm.DJB2 },
		);
		const result2 = hashToNumberSync(
			{ foo: value },
			{ min, max, algorithm: HashAlgorithm.DJB2 },
		);

		// Assert
		expect(result).toBe(result2);
	});

	test("hashToNumberSync with djb2 stays within range", () => {
		// Arrange
		const min = 0;
		const max = 10;
		const data = Array.from({ length: 500 }, () => ({
			key: faker.string.uuid(),
			value: faker.string.alphanumeric(10),
		}));
		let outOfRange = false;

		for (const item of data) {
			const result = hashToNumberSync(item, {
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

	test("hashToNumberSync throws error when min >= max", () => {
		// Arrange
		const min = 10;
		const max = 5;

		// Act & Assert
		expect(() => hashToNumberSync("test", { min, max })).toThrowError(
			"Invalid range: min (10) must be less than max (5)",
		);
	});

	test("hashToNumberSync throws error when min equals max", () => {
		// Arrange
		const min = 5;
		const max = 5;

		// Act & Assert
		expect(() => hashToNumberSync("test", { min, max })).toThrowError(
			"Invalid range: min (5) must be less than max (5)",
		);
	});

	test("hashToNumberSync uses default algorithm when not provided", () => {
		// Arrange & Act
		const result = hashToNumberSync("test", { min: 0, max: 10 });

		// Assert
		expect(result).toBeDefined();
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThanOrEqual(10);
	});

	test("hashToNumberSync handles potential integer overflow scenarios", () => {
		// Test with different combinations
		const testCases = [
			{ min: -1000, max: 1000 },
			{ min: 1, max: 2 },
			{ min: 0, max: 1 },
			{ min: -100, max: -50 },
			{ min: Number.MIN_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER + 100 },
		];

		for (const { min, max } of testCases) {
			const result = hashToNumberSync("edge case test", { min, max });
			expect(result).toBeGreaterThanOrEqual(min);
			expect(result).toBeLessThanOrEqual(max);
		}
	});

	test("hashToNumberSync comprehensively tests range boundaries", () => {
		// Generate many test cases
		const testCases = Array.from({ length: 1000 }, () => ({
			data: faker.string.alphanumeric(faker.number.int({ min: 1, max: 100 })),
			min: faker.number.int({ min: -1000, max: 0 }),
			max: faker.number.int({ min: 1, max: 1000 }),
		}));

		for (const { data, min, max } of testCases) {
			const result = hashToNumberSync(data, { min, max });
			expect(result).toBeGreaterThanOrEqual(min);
			expect(result).toBeLessThanOrEqual(max);
		}
	});

	test("hashToNumberSync with all non-crypto algorithms stays within range", () => {
		// Test all non-crypto algorithms
		const testData = "test data";
		const min = 0;
		const max = 100;

		const nonCryptoAlgorithms = [
			HashAlgorithm.DJB2,
			HashAlgorithm.FNV1,
			HashAlgorithm.MURMER,
			HashAlgorithm.CRC32,
		];

		for (const algorithm of nonCryptoAlgorithms) {
			const result = hashToNumberSync(testData, { min, max, algorithm });
			expect(result).toBeGreaterThanOrEqual(min);
			expect(result).toBeLessThanOrEqual(max);
		}
	});
});
