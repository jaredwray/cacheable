import { describe, expect, test } from "vitest";
import { NodeCache } from "../src/index.js";

describe("NodeCache", () => {
	test("should create a new instance of NodeCache", () => {
		const cache = new NodeCache({ checkperiod: 0 });
		expect(cache).toBeInstanceOf(NodeCache);
	});
});
