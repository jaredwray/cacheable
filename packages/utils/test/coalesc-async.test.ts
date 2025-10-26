import { faker } from "@faker-js/faker";
import { describe, expect, test } from "vitest";
import { coalesceAsync } from "../src/coalesce-async.js";

describe("coalesceAsync", () => {
	test("returns a function that coalesces calls", async () => {
		const key = faker.string.alphanumeric(10);
		let callCount = 0;
		const fn = async () => {
			callCount++;
			return "result";
		};

		const result = await Promise.all([
			coalesceAsync(key, fn),
			coalesceAsync(key, fn),
			coalesceAsync(key, fn),
		]);

		expect(result).toEqual(["result", "result", "result"]);
		expect(callCount).toBe(1);
	});

	test("handles errors and rejects all coalesced calls", async () => {
		const key = faker.string.alphanumeric(10);
		let callCount = 0;
		const errorMessage = "Test error";
		const fn = async () => {
			callCount++;
			throw new Error(errorMessage);
		};

		const promises = [
			coalesceAsync(key, fn),
			coalesceAsync(key, fn),
			coalesceAsync(key, fn),
		];

		await expect(promises[0]).rejects.toThrow(errorMessage);
		await expect(promises[1]).rejects.toThrow(errorMessage);
		await expect(promises[2]).rejects.toThrow(errorMessage);
		expect(callCount).toBe(1);
	});
});
