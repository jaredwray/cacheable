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
});
