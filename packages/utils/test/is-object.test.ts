import { describe, expect, test } from "vitest";
import { isObject } from "../src/is-object.js";

describe("isObject", () => {
	test("returns true for plain objects", () => {
		// Arrange & Act & Assert
		expect(isObject({})).toBe(true);
		expect(isObject({ foo: "bar" })).toBe(true);
		expect(isObject({ a: 1, b: 2 })).toBe(true);
		expect(isObject(Object.create(null))).toBe(true);
		expect(isObject(new Object())).toBe(true);
	});

	test("returns false for null", () => {
		// Arrange & Act & Assert
		expect(isObject(null)).toBe(false);
	});

	test("returns false for arrays", () => {
		// Arrange & Act & Assert
		expect(isObject([])).toBe(false);
		expect(isObject([1, 2, 3])).toBe(false);
		expect(isObject(["a", "b"])).toBe(false);
		expect(isObject([])).toBe(false);
	});

	test("returns false for primitive types", () => {
		// Arrange & Act & Assert
		expect(isObject("string")).toBe(false);
		expect(isObject("")).toBe(false);
		expect(isObject(123)).toBe(false);
		expect(isObject(0)).toBe(false);
		expect(isObject(-1)).toBe(false);
		expect(isObject(true)).toBe(false);
		expect(isObject(false)).toBe(false);
		expect(isObject(undefined)).toBe(false);
		expect(isObject(Symbol("test"))).toBe(false);
		expect(isObject(BigInt(123))).toBe(false);
	});

	test("returns false for functions", () => {
		// Arrange & Act & Assert
		expect(isObject(() => {})).toBe(false);
		expect(isObject(() => {})).toBe(false);
		expect(isObject(async () => {})).toBe(false);
		expect(isObject(function* generator() {})).toBe(false);
		expect(isObject(Date)).toBe(false);
		expect(isObject(Object)).toBe(false);
	});

	test("returns true for built-in object types", () => {
		// Arrange & Act & Assert
		expect(isObject(new Date())).toBe(true);
		expect(isObject(/test/)).toBe(true);
		expect(isObject(/test/)).toBe(true);
		expect(isObject(new Error("test"))).toBe(true);
		expect(isObject(new Map())).toBe(true);
		expect(isObject(new Set())).toBe(true);
		expect(isObject(new WeakMap())).toBe(true);
		expect(isObject(new WeakSet())).toBe(true);
		expect(isObject(new Promise(() => {}))).toBe(true);
	});

	test("returns true for class instances", () => {
		// Arrange
		class TestClass {
			constructor(public value: string) {}
		}
		const instance = new TestClass("test");

		// Act & Assert
		expect(isObject(instance)).toBe(true);
	});

	test("type guard works correctly", () => {
		// Arrange
		const value: unknown = { foo: "bar" };

		// Act & Assert
		if (isObject<{ foo: string }>(value)) {
			// TypeScript should narrow the type here
			expect(value.foo).toBe("bar");
		} else {
			// This should not execute
			expect(true).toBe(false);
		}
	});

	test("type guard with generic parameter", () => {
		// Arrange
		interface TestInterface {
			name: string;
			age: number;
		}
		const value: unknown = { name: "John", age: 30 };

		// Act & Assert
		if (isObject<TestInterface>(value)) {
			// TypeScript should narrow the type here
			expect(value.name).toBe("John");
			expect(value.age).toBe(30);
		} else {
			// This should not execute
			expect(true).toBe(false);
		}
	});
});
