import { faker } from "@faker-js/faker";
import type { Keyv } from "keyv";
import { Keyv as Keyv6 } from "keyv6";
import { describe, expect, it, vi } from "vitest";
import { createCache } from "../src/index.js";

describe("Keyv 6 store", () => {
	const ttl = 1000;
	// The `stores` option has the Keyv 5 type, so a Keyv 6 instance needs a cast.
	const createKeyv6Cache = () =>
		createCache({ stores: [new Keyv6() as unknown as Keyv] });

	it("wrap returns the cached value", async () => {
		const cache = createKeyv6Cache();
		const key = faker.string.alpha(20);
		const getValue = vi.fn(() => ({ id: 1 }));

		await cache.wrap(key, getValue, ttl);
		await expect(cache.wrap(key, getValue, ttl)).resolves.toEqual({ id: 1 });
		expect(getValue).toBeCalledTimes(1);
	});

	it("ttl returns the expiration", async () => {
		const cache = createKeyv6Cache();
		const key = faker.string.alpha(20);

		await cache.set(key, faker.string.sample(), ttl);
		await expect(cache.ttl(key)).resolves.toBeGreaterThan(Date.now());
	});
});
