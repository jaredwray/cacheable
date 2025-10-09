import fs from "node:fs";
import path from "node:path";
import { parse } from "flatted";
import { describe, expect, test } from "vitest";
import { FlatCache } from "../src/index.js";

describe("Legacy Store", () => {
	test("Handle legacy format", () => {
		const legacyCachePath = path.resolve(__dirname, "fixtures/.cache/legacy1");
		const legacyCacheData = fs.readFileSync(legacyCachePath, "utf8");
		const data = parse(legacyCacheData);

		// Verify the parsed data structure
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBeGreaterThan(0);
		expect(data[0]).toHaveProperty("key");
		expect(data[0]).toHaveProperty("value");
	});

	test("Load legacy format via FlatCache", () => {
		const cache = new FlatCache();
		const legacyCachePath = path.resolve(__dirname, "fixtures/.cache/legacy1");

		cache.loadFile(legacyCachePath);

		// Verify the data was loaded correctly
		const value = cache.getKey("testKey");
		expect(value).toBeDefined();
		expect(value).toHaveProperty("data", "test data");
	});

	test("Load cache4 legacy format via FlatCache", () => {
		const cache = new FlatCache();
		const cache4Path = path.resolve(__dirname, "fixtures/.cache/cache4");

		cache.loadFile(cache4Path);

		// Verify the data was loaded correctly from cache4
		const valueBaz = cache.getKey("baz");
		expect(valueBaz).toEqual([1, 2, 3]);

		const valueBar = cache.getKey("bar");
		expect(valueBar).toEqual({ foo: "bar" });

		// All three keys should be present
		const keys = cache.keys();
		expect(keys).toContain("baz");
		expect(keys).toContain("bar");
	});

	test("Load cache1 legacy format via FlatCache", () => {
		const cache = new FlatCache();
		const cache1Path = path.resolve(__dirname, "fixtures/.cache/cache1");

		cache.loadFile(cache1Path);

		// Verify the data was loaded correctly from cache1
		const value = cache.getKey("testKey");
		expect(value).toBeDefined();
		expect(value).toHaveProperty("data", "test data");

		// Check that the key is present
		const keys = cache.keys();
		expect(keys).toContain("testKey");
		expect(keys.length).toBe(1);
	});
});
