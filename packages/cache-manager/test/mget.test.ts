import { faker } from "@faker-js/faker";
import { Keyv } from "keyv";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCache } from "../src/index.js";

describe("mget", () => {
	let keyv: Keyv;
	let cache: ReturnType<typeof createCache>;
	let ttl = 500;
	let list = [] as Array<{ key: string; value: string }>;

	beforeEach(async () => {
		ttl = faker.number.int({ min: 500, max: 1000 });
		keyv = new Keyv();
		list = [
			{ key: faker.string.alpha(20), value: faker.string.sample() },
			{ key: faker.string.alpha(20), value: faker.string.sample() },
			{ key: faker.string.alpha(20), value: faker.string.sample() },
		];
	});

	describe("blocking", () => {
		beforeEach(() => {
			cache = createCache({ stores: [keyv], nonBlocking: false });
		});

		it("basic", async () => {
			await cache.mset(list);
			const keys = list.map((item) => item.key);
			const values = list.map((item) => item.value);
			await expect(cache.mget(keys)).resolves.toEqual(values);
		});

		it("error", async () => {
			keyv.getMany = () => {
				throw new Error("getMany error");
			};

			const mgetEventMock = vi.fn();
			cache.on("mget", mgetEventMock);
			const keys = list.map((item) => item.key);
			await expect(cache.mget(keys)).resolves.toEqual(
				list.map(() => undefined),
			);
			expect(mgetEventMock).toHaveBeenCalledWith({
				keys,
				error: expect.any(Error),
			});
		});

		it("calls getMany instead of get", async () => {
			const mgetSpy = vi.spyOn(keyv, "getMany");
			const getSpy = vi.spyOn(keyv, "get");
			await expect(cache.mget(["key"])).resolves.toEqual([undefined]);
			expect(mgetSpy).toHaveBeenCalled();
			expect(getSpy).not.toHaveBeenCalled();
		});

		it("calls each store sequentially until it has found every value", async () => {
			const keyv2 = new Keyv();
			const keyv3 = new Keyv();
			const keyv4 = new Keyv();
			cache = createCache({
				stores: [keyv, keyv2, keyv3, keyv4],
				nonBlocking: false,
			});

			await Promise.all([
				keyv.set(list[0].key, list[0].value, ttl),
				keyv2.set(list[1].key, list[1].value, ttl),
				keyv3.set(list[2].key, list[2].value, ttl),
			]);

			const getManySpy1 = vi.spyOn(keyv, "getMany");
			const getManySpy2 = vi.spyOn(keyv2, "getMany");
			const getManySpy3 = vi.spyOn(keyv3, "getMany");
			const getManySpy4 = vi.spyOn(keyv4, "getMany");

			const keys = list.map((item) => item.key);
			const values = list.map((item) => item.value);
			await expect(cache.mget(keys)).resolves.toEqual(values);
			expect(getManySpy1).toHaveBeenCalledWith(keys);
			expect(getManySpy2).toHaveBeenCalledWith(keys.slice(1));
			expect(getManySpy3).toHaveBeenCalledWith(keys.slice(2));
			expect(getManySpy4).not.toHaveBeenCalled();
		});
	});

	describe("non-blocking", () => {
		beforeEach(() => {
			cache = createCache({ stores: [keyv], nonBlocking: true });
		});

		it("basic", async () => {
			await cache.mset(list);
			const keys = list.map((item) => item.key);
			const values = list.map((item) => item.value);
			await expect(cache.mget(keys)).resolves.toEqual(values);
		});

		it("error", async () => {
			keyv.getMany = () => {
				throw new Error("getMany error");
			};

			const mgetEventMock = vi.fn();
			cache.on("mget", mgetEventMock);
			const keys = list.map((item) => item.key);
			await expect(cache.mget(keys)).resolves.toEqual(
				list.map(() => undefined),
			);
			expect(mgetEventMock).toHaveBeenCalledWith({
				keys,
				error: expect.any(Error),
			});
		});
	});
});
