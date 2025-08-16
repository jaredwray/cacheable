import { Keyv } from "keyv";
import { beforeEach, describe, expect, it } from "vitest";
import { createCache } from "../src/index.js";

describe("cacheId", () => {
	let keyv: Keyv;

	beforeEach(async () => {
		keyv = new Keyv();
	});

	it("user set", () => {
		const cache = createCache({ stores: [keyv], cacheId: "my-cache-id" });
		expect(cache.cacheId()).toEqual("my-cache-id");
	});
	it("auto generated", () => {
		const cache = createCache({ stores: [keyv] });
		expect(cache.cacheId()).toBeTypeOf("string");
	});
});
