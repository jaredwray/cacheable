import { faker } from "@faker-js/faker";
import { createKeyv } from "@keyv/redis";
import { Keyv } from "keyv";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCache } from "../src/index.js";
import { sleep } from "./sleep.js";

describe("mdel", () => {
	let keyv: Keyv;
	let cache: ReturnType<typeof createCache>;
	// biome-ignore lint/correctness/noUnusedVariables: test file
	let ttl = 500;
	let list = [] as Array<{ key: string; value: string }>;

	beforeEach(async () => {
		ttl = faker.number.int({ min: 500, max: 1000 });
		keyv = new Keyv();
		cache = createCache({ stores: [keyv] });
		list = [
			{ key: faker.string.alpha(20), value: faker.string.sample() },
			{ key: faker.string.alpha(20), value: faker.string.sample() },
			{ key: faker.string.alpha(20), value: faker.string.sample() },
		];
	});

	it("basic", async () => {
		await cache.mset(list);
		await expect(cache.get(list[0].key)).resolves.toEqual(list[0].value);
		await expect(cache.get(list[1].key)).resolves.toEqual(list[1].value);
		await expect(cache.get(list[2].key)).resolves.toEqual(list[2].value);
		await cache.mdel([list[0].key, list[1].key]);
		await expect(cache.get(list[0].key)).resolves.toBeUndefined();
		await expect(cache.get(list[1].key)).resolves.toBeUndefined();
		await expect(cache.get(list[2].key)).resolves.toEqual(list[2].value);
	});

	it("should delete every key with a single store call", async () => {
		const cache = createCache({ stores: [keyv], nonBlocking: false });
		await cache.mset(list);
		const keys = list.map(({ key }) => key);
		const deleteManyHandler = vi.spyOn(keyv, "deleteMany");

		await expect(cache.mdel(keys)).resolves.toBe(true);

		expect(deleteManyHandler).toHaveBeenCalledOnce();
		expect(deleteManyHandler).toHaveBeenCalledWith(keys);
	});

	it("should call deleteMany once per store", async () => {
		const secondKeyv = new Keyv();
		const cache = createCache({
			stores: [keyv, secondKeyv],
			nonBlocking: false,
		});
		await cache.mset(list);
		const keys = list.map(({ key }) => key);
		const firstHandler = vi.spyOn(keyv, "deleteMany");
		const secondHandler = vi.spyOn(secondKeyv, "deleteMany");

		await cache.mdel(keys);

		expect(firstHandler).toHaveBeenCalledOnce();
		expect(firstHandler).toHaveBeenCalledWith(keys);
		expect(secondHandler).toHaveBeenCalledOnce();
		expect(secondHandler).toHaveBeenCalledWith(keys);
	});

	it("should not dispatch an empty key list to Redis", async () => {
		const redis = createKeyv();
		const cache = createCache({ stores: [redis], nonBlocking: false });
		const deleteManyHandler = vi.spyOn(redis, "deleteMany");
		const listener = vi.fn();
		cache.on("mdel", listener);

		try {
			await expect(cache.mdel([])).resolves.toBe(true);
			expect(deleteManyHandler).not.toHaveBeenCalled();
			expect(listener).toHaveBeenCalledOnce();
			expect(listener).toHaveBeenCalledWith({ keys: [] });
		} finally {
			await redis.disconnect();
		}
	});

	it("should delete keys through the native Redis deleteMany", async () => {
		const redis = createKeyv();
		redis.throwOnErrors = true;
		const cache = createCache({ stores: [redis], nonBlocking: false });

		try {
			await cache.mset(list);
			const nativeDeleteManyHandler = vi.spyOn(redis.store, "deleteMany");
			const keys = [list[0].key, list[1].key];

			await expect(cache.mdel(keys)).resolves.toBe(true);

			expect(nativeDeleteManyHandler).toHaveBeenCalledOnce();
			await expect(redis.get(list.map(({ key }) => key))).resolves.toEqual([
				undefined,
				undefined,
				list[2].value,
			]);
		} finally {
			await Promise.allSettled(list.map(async ({ key }) => redis.delete(key)));
			await redis.disconnect();
		}
	});

	it("should work blocking", async () => {
		let resolveDeleted: (value: boolean) => void = () => undefined;
		const deletePromise = new Promise<boolean>((_resolve) => {
			resolveDeleted = _resolve;
		});
		const cache = createCache({ stores: [keyv], nonBlocking: false });
		await cache.mset(list);

		const delHandler = vi
			.spyOn(keyv, "deleteMany")
			.mockReturnValue(deletePromise);
		const deleteResolved = vi.fn();
		const deleteRejected = vi.fn();
		cache
			.mdel(list.map(({ key }) => key))
			.catch(deleteRejected)
			.then(deleteResolved);

		expect(delHandler).toHaveBeenCalledOnce();

		await sleep(200);

		expect(deleteResolved).not.toBeCalled();
		expect(deleteRejected).not.toBeCalled();

		resolveDeleted(true);
		await sleep(1);

		expect(deleteResolved).toBeCalled();
		expect(deleteRejected).not.toBeCalled();
	});

	it("should work non-blocking", async () => {
		const deletePromise = new Promise<boolean>((_resolve) => {
			// Do nothing, this will be a never resolved promise
		});
		const cache = createCache({ stores: [keyv], nonBlocking: true });
		await cache.mset(list);

		const delHandler = vi
			.spyOn(keyv, "deleteMany")
			.mockReturnValue(deletePromise);
		const deleteResolved = vi.fn();
		const deleteRejected = vi.fn();
		cache
			.mdel(list.map(({ key }) => key))
			.catch(deleteRejected)
			.then(deleteResolved);

		expect(delHandler).toHaveBeenCalledOnce();

		await sleep(1);

		expect(deleteResolved).toBeCalled();
		expect(deleteRejected).not.toBeCalled();
	});
});
