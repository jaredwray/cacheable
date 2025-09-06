import { describe, expect, test } from "vitest";
import { runIfFn } from "../src/run-if-fn.js";

describe("runIfFn", () => {
	test("executes function when valueOrFunction is a function", () => {
		// Arrange
		const mockFn = (a: number, b: number) => a + b;

		// Act
		const result = runIfFn(mockFn, 2, 3);

		// Assert
		expect(result).toBe(5);
	});

	test("executes function with no arguments", () => {
		// Arrange
		const mockFn = () => "hello world";

		// Act
		const result = runIfFn(mockFn);

		// Assert
		expect(result).toBe("hello world");
	});

	test("executes function with single argument", () => {
		// Arrange
		const mockFn = (name: string) => `Hello, ${name}!`;

		// Act
		const result = runIfFn(mockFn, "Alice");

		// Assert
		expect(result).toBe("Hello, Alice!");
	});

	test("executes function with multiple arguments", () => {
		// Arrange
		const mockFn = (a: number, b: number, c: number) => a * b * c;

		// Act
		const result = runIfFn(mockFn, 2, 3, 4);

		// Assert
		expect(result).toBe(24);
	});

	test("executes function that returns object", () => {
		// Arrange
		const mockFn = (name: string, age: number) => ({ name, age });

		// Act
		const result = runIfFn(mockFn, "Bob", 30);

		// Assert
		expect(result).toEqual({ name: "Bob", age: 30 });
	});

	test("executes function that returns array", () => {
		// Arrange
		const mockFn = (...items: string[]) => items;

		// Act
		const result = runIfFn(mockFn, "a", "b", "c");

		// Assert
		expect(result).toEqual(["a", "b", "c"]);
	});

	test("executes function that returns boolean", () => {
		// Arrange
		const mockFn = (value: number) => value > 10;

		// Act & Assert
		expect(runIfFn(mockFn, 15)).toBe(true);
		expect(runIfFn(mockFn, 5)).toBe(false);
	});

	test("returns value when valueOrFunction is not a function", () => {
		// Arrange & Act & Assert
		expect(runIfFn("string value")).toBe("string value");
		expect(runIfFn(42)).toBe(42);
		expect(runIfFn(true)).toBe(true);
		expect(runIfFn(false)).toBe(false);
		expect(runIfFn(null)).toBe(null);
		expect(runIfFn(undefined)).toBe(undefined);
	});

	test("returns object when valueOrFunction is an object", () => {
		// Arrange
		const obj = { name: "test", value: 123 };

		// Act
		const result = runIfFn(obj);

		// Assert
		expect(result).toBe(obj);
		expect(result).toEqual({ name: "test", value: 123 });
	});

	test("returns array when valueOrFunction is an array", () => {
		// Arrange
		const arr = [1, 2, 3];

		// Act
		const result = runIfFn(arr);

		// Assert
		expect(result).toBe(arr);
		expect(result).toEqual([1, 2, 3]);
	});

	test("executes arrow function", () => {
		// Arrange
		const arrowFn = (x: number) => x * 2;

		// Act
		const result = runIfFn(arrowFn, 5);

		// Assert
		expect(result).toBe(10);
	});

	test("executes async function", () => {
		// Arrange
		const asyncFn = async (value: string) => `async-${value}`;

		// Act
		const result = runIfFn(asyncFn, "test");

		// Assert
		expect(result).toBeInstanceOf(Promise);
	});

	test("executes function with mixed argument types", () => {
		// Arrange
		const mixedFn = (str: string, num: number, bool: boolean) => ({
			str,
			num,
			bool,
		});

		// Act
		const result = runIfFn(mixedFn, "hello", 42, true);

		// Assert
		expect(result).toEqual({
			str: "hello",
			num: 42,
			bool: true,
		});
	});

	test("executes function that throws error", () => {
		// Arrange
		const errorFn = () => {
			throw new Error("Test error");
		};

		// Act & Assert
		expect(() => runIfFn(errorFn)).toThrow("Test error");
	});

	test("returns number zero", () => {
		// Arrange & Act & Assert
		expect(runIfFn(0)).toBe(0);
	});

	test("returns empty string", () => {
		// Arrange & Act & Assert
		expect(runIfFn("")).toBe("");
	});
});
