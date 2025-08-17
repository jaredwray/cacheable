import { describe, expect, test } from "vitest";
import { hash, hashToNumber } from "../src/hash.js";

describe("hash", () => {
	test("hashes an object using the specified algorithm", () => {
		// Arrange
		const object = { foo: "bar" };
		const algorithm = "sha256";

		// Act
		const result = hash(object, algorithm);

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
		// Arrange
		const object = { foo: "bar" };
		const algorithm = "md5foo";

		// Act & Assert
		expect(() => hashToNumber(object, 0, 100, algorithm)).toThrowError(
			"Unsupported hash algorithm: 'md5foo'",
		);
	});

	test("throws an error when the algorithm is not supported", () => {
		expect(() => hash("foo", "md5foo")).toThrowError(
			"Unsupported hash algorithm: 'md5foo'",
		);
	});
});
