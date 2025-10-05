import { Keyv } from "keyv";
import { describe, expect, test } from "vitest";
import { isKeyvInstance } from "../src/is-keyv-instance.js";

describe("isKeyvInstance", () => {
	test("returns true for actual Keyv instance", () => {
		// Arrange
		const keyv = new Keyv();

		// Act & Assert
		expect(isKeyvInstance(keyv)).toBe(true);
	});

	test("returns true for object with all Keyv methods", () => {
		// Arrange
		const keyvLike = {
			generateIterator: () => {},
			get: () => {},
			getMany: () => {},
			set: () => {},
			setMany: () => {},
			delete: () => {},
			deleteMany: () => {},
			has: () => {},
			hasMany: () => {},
			clear: () => {},
			disconnect: () => {},
			serialize: () => {},
			deserialize: () => {},
		};

		// Act & Assert
		expect(isKeyvInstance(keyvLike)).toBe(true);
	});

	test("returns false for object missing some Keyv methods", () => {
		// Arrange
		const notKeyvLike = {
			get: () => {},
			set: () => {},
			delete: () => {},
			// Missing other methods
		};

		// Act & Assert
		expect(isKeyvInstance(notKeyvLike)).toBe(false);
	});

	test("returns false for object with non-function Keyv properties", () => {
		// Arrange
		const notKeyvLike = {
			generateIterator: "not a function",
			get: () => {},
			getMany: () => {},
			set: () => {},
			setMany: () => {},
			delete: () => {},
			deleteMany: () => {},
			has: () => {},
			hasMany: () => {},
			clear: () => {},
			disconnect: () => {},
			serialize: () => {},
			deserialize: () => {},
		};

		// Act & Assert
		expect(isKeyvInstance(notKeyvLike)).toBe(false);
	});

	test("returns false for null", () => {
		// Act & Assert
		expect(isKeyvInstance(null)).toBe(false);
	});

	test("returns false for undefined", () => {
		// Act & Assert
		expect(isKeyvInstance(undefined)).toBe(false);
	});

	test("returns false for primitive types", () => {
		// Act & Assert
		expect(isKeyvInstance("string")).toBe(false);
		expect(isKeyvInstance(123)).toBe(false);
		expect(isKeyvInstance(true)).toBe(false);
	});

	test("returns false for plain object", () => {
		// Arrange
		const plainObject = { foo: "bar" };

		// Act & Assert
		expect(isKeyvInstance(plainObject)).toBe(false);
	});

	test("returns false for array", () => {
		// Act & Assert
		expect(isKeyvInstance([])).toBe(false);
		expect(isKeyvInstance([1, 2, 3])).toBe(false);
	});

	test("returns false for empty object", () => {
		// Act & Assert
		expect(isKeyvInstance({})).toBe(false);
	});
});
