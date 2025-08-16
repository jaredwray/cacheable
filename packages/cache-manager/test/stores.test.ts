import { simpleFaker } from "@faker-js/faker";
import { createKeyv } from "@keyv/redis";
import { Keyv } from "keyv";
import { describe, expect, it } from "vitest";
import { createCache } from "../src/index.js";

describe("stores", () => {
	it("can get the keyv store", () => {
		const cache = createCache();
		expect(cache.stores.length).toEqual(1);
	});

	it("can see multiple stores", () => {
		const keyv = new Keyv();
		const redis = createKeyv();
		const cache = createCache({ stores: [keyv, redis] });
		expect(cache.stores.length).toEqual(2);
		expect(cache.stores[0]).toEqual(keyv);
		expect(cache.stores[1]).toEqual(redis);
	});

	it("can get the keyv store and do iterator", async () => {
		const cache = createCache();
		expect(cache.stores.length).toEqual(1);
		const keyName = simpleFaker.string.uuid();
		const keyValue = simpleFaker.string.uuid();
		await cache.set(keyName, keyValue);
		const keyv = cache.stores[0];
		expect(keyv).toBeInstanceOf(Keyv);

		// biome-ignore lint/suspicious/noImplicitAnyLet: test file
		let returnValue;

		if (keyv?.iterator) {
			for await (const [key, value] of keyv.iterator({})) {
				if (key === keyName) {
					returnValue = value;
				}
			}
		}

		expect(returnValue).toEqual(keyValue);
	});
});
