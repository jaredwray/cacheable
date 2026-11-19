import { setImmediate as nextTurn } from "node:timers/promises";
import { faker } from "@faker-js/faker";
import { Keyv } from "keyv";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCache } from "../src/index.js";
import { sleep } from "./sleep.js";

describe("wrap", () => {
	let keyv: Keyv;
	let cache: ReturnType<typeof createCache>;
	let ttl = 500;
	const data = { key: "", value: "" };

	beforeEach(async () => {
		data.key = faker.string.alpha(20);
		data.value = faker.string.sample();
		ttl = faker.number.int({ min: 500, max: 1000 });
		keyv = new Keyv();
		cache = createCache({ stores: [keyv] });
	});

	it("basic", async () => {
		const getValue = vi.fn(() => data.value);
		await cache.wrap(data.key, getValue);
		await cache.wrap(data.key, getValue);
		expect(getValue).toBeCalledTimes(1);
	});

	it("ttl - milliseconds", async () => {
		await cache.wrap(data.key, async () => data.value, ttl);
		await expect(cache.get(data.key)).resolves.toEqual(data.value);
		await sleep(ttl + 100);
		await expect(cache.get(data.key)).resolves.toBeUndefined();
	});

	it("ttl - function", async () => {
		const getTtlFunction = vi.fn(() => ttl);
		await cache.wrap(data.key, async () => data.value, getTtlFunction);
		await expect(cache.get(data.key)).resolves.toEqual(data.value);
		await sleep(ttl + 100);
		await expect(cache.get(data.key)).resolves.toBeUndefined();
		expect(getTtlFunction).toHaveBeenCalledTimes(1);
	});

	it("ttl - options", async () => {
		await cache.wrap(data.key, async () => data.value, { ttl });
		await expect(cache.get(data.key)).resolves.toEqual(data.value);
		await sleep(ttl + 100);
		await expect(cache.get(data.key)).resolves.toBeUndefined();
	});

	it("returns single value or raw storage-data", async () => {
		// Run pristine and expect single value
		await expect(cache.wrap(data.key, () => data.value, ttl)).resolves.toEqual(
			data.value,
		);
		// Expect cached response with raw data
		await expect(
			cache.wrap(data.key, () => data.value, { ttl, raw: true }),
		).resolves.toEqual({ value: data.value, expires: expect.any(Number) });

		// Run pristine with new key and expect raw data
		await expect(
			cache.wrap(`${data.key}i`, () => data.value, { ttl, raw: true }),
		).resolves.toEqual({ value: data.value, expires: expect.any(Number) });
		// Expect cached response with single value
		await expect(
			cache.wrap(`${data.key}i`, () => data.value, ttl),
		).resolves.toEqual(data.value);
	});

	it("calls fn once to fetch value on cache miss when invoked multiple times", async () => {
		const getValue = vi.fn().mockResolvedValue(data.value);

		// Confirm the cache is empty.
		await expect(cache.get(data.key)).resolves.toBeUndefined();

		// Simulate several concurrent requests for the same value.
		const array = Array.from({ length: 10 }).fill(null);
		const results = await Promise.allSettled(
			array.map(async () => cache.wrap(data.key, getValue, ttl)),
		);

		// Assert that the function was called exactly once.
		expect(getValue).toHaveBeenCalledTimes(1);

		// Assert that all requests resolved to the same value.
		for (const result of results) {
			expect(result).toMatchObject({
				status: "fulfilled",
				value: data.value,
			});
		}
	});

	it.each([
		[500, 250],
		[{ ttl: 500, refreshThreshold: 250 }, undefined],
	])(
		"should allow dynamic refreshThreshold on wrap function with ttl/options param as %s",
		async (ttlOrOptions, refreshThreshold) => {
			// 1st call should be cached
			expect(
				await cache.wrap(
					data.key,
					async () => 0,
					ttlOrOptions as never,
					refreshThreshold,
				),
			).toEqual(0);
			await sleep(260);
			// Background refresh, but stale value returned
			expect(
				await cache.wrap(
					data.key,
					async () => 1,
					ttlOrOptions as never,
					refreshThreshold,
				),
			).toEqual(0);
			// New value in cache
			expect(
				await cache.wrap(
					data.key,
					async () => 2,
					ttlOrOptions as never,
					refreshThreshold,
				),
			).toEqual(1);

			await sleep(260);
			// No background refresh with the new override params
			expect(await cache.wrap(data.key, async () => 3, undefined, 125)).toEqual(
				1,
			);
			await sleep(140);
			// Background refresh, but stale value returned
			expect(await cache.wrap(data.key, async () => 4, undefined, 125)).toEqual(
				1,
			);
			expect(await cache.wrap(data.key, async () => 5, undefined, 125)).toEqual(
				4,
			);
		},
	);

	it("should allow refreshThreshold function on wrap function", async () => {
		const config = {
			ttl: (v: number) => v * 1000,
			refreshThreshold: (v: number) => v * 500,
		};

		// 1st call should be cached
		expect(
			await cache.wrap(
				data.key,
				async () => 1,
				config.ttl,
				config.refreshThreshold,
			),
		).toEqual(1);
		await sleep(510);
		// Background refresh, but stale value returned
		expect(
			await cache.wrap(
				data.key,
				async () => 2,
				config.ttl,
				config.refreshThreshold,
			),
		).toEqual(1);
		// New value in cache
		expect(
			await cache.wrap(
				data.key,
				async () => 2,
				config.ttl,
				config.refreshThreshold,
			),
		).toEqual(2);
		await sleep(1010);
		// No background refresh with the new override params
		expect(await cache.wrap(data.key, async () => 3, undefined, 500)).toEqual(
			2,
		);
		await sleep(510);
		// Background refresh, but stale value returned
		expect(await cache.wrap(data.key, async () => 4, undefined, 500)).toEqual(
			2,
		);
		expect(await cache.wrap(data.key, async () => 5, undefined, 500)).toEqual(
			4,
		);
	});

	it("should support nested calls of other caches - no mutual state", async () => {
		const getValueA = vi.fn(() => "A");
		const getValueB = vi.fn(() => "B");
		const anotherCache = createCache({ stores: [new Keyv()] });
		expect(
			await cache.wrap(data.key, async () =>
				anotherCache.wrap(data.key, getValueB).then((v) => v + getValueA()),
			),
		).toEqual("BA");
		expect(getValueA).toHaveBeenCalledOnce();
		expect(getValueB).toHaveBeenCalledOnce();
	});

	it("should re-evaluate ttl function on fresh value when triggered by refreshThreshold", async () => {
		const config = { ttl: 1000, refreshThreshold: 500 };
		const getTtlFunction = vi.fn(() => config.ttl);
		let value = 10;

		expect(
			await cache.wrap(
				data.key,
				async () => ++value,
				getTtlFunction,
				config.refreshThreshold,
			),
		).toEqual(11); // 1st call should be cached
		expect(getTtlFunction).toHaveBeenNthCalledWith(1, 11); // Ttl func called 1st time when cache empty
		await sleep(750);
		expect(
			await cache.wrap(
				data.key,
				async () => ++value,
				getTtlFunction,
				config.refreshThreshold,
			),
		).toEqual(11); // Trigger background refresh. stale value returned
		expect(getTtlFunction).toHaveBeenNthCalledWith(2, 12); // Ttl func called 2nd time triggered by refreshThreshold on fresh item
	});

	it("should support nested calls of other caches - no mutual state", async () => {
		const getValueA = vi.fn(() => "A");
		const getValueB = vi.fn(() => "B");
		const anotherCache = createCache({ stores: [new Keyv()] });

		expect(
			await cache.wrap(data.key, async () =>
				anotherCache.wrap(data.key, getValueB).then((v) => v + getValueA()),
			),
		).toEqual("BA");
		expect(getValueA).toHaveBeenCalledOnce();
		expect(getValueB).toHaveBeenCalledOnce();
	});

	it("store get failed", async () => {
		const getValue = vi.fn(() => data.value);
		keyv.get = () => {
			throw new Error("get failed");
		};

		const refreshThreshold = ttl / 2;
		await expect(
			cache.wrap(data.key, getValue, ttl, refreshThreshold),
		).resolves.toEqual(data.value);
		await expect(
			cache.wrap(data.key, getValue, ttl, refreshThreshold),
		).resolves.toEqual(data.value);
		expect(getValue).toBeCalledTimes(2);
	});
});

describe("wrap with multi-layer stores", () => {
	let keyv1: Keyv;
	let keyv2: Keyv;
	let cache: ReturnType<typeof createCache>;
	const ttl1 = 400;
	const ttl2 = 1000;
	const refreshThreshold = 250;
	const data = { key: "", value: "" };

	beforeEach(async () => {
		data.key = faker.string.alpha(20);
		data.value = faker.string.sample();
		keyv1 = new Keyv({ ttl: ttl1 });
		keyv2 = new Keyv({ ttl: ttl2 });
		cache = createCache({ refreshThreshold, stores: [keyv1, keyv2] });
	});

	it("should refresh according to refreshThreshold", async () => {
		// 1st call should be cached
		expect(await cache.wrap(data.key, async () => 0)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(0);
		expect(await keyv2.get(data.key)).toEqual(0);

		// Sleep 251ms, trigger keyv1 refresh
		await sleep(251);

		// Background refresh, but stale value returned, while keyv1 is already updated
		expect(await cache.wrap(data.key, async () => 1)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(0);

		// New value returned
		expect(await cache.wrap(data.key, async () => 2)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(0);

		// Sleep 1001ms, keyv1 expired, trigger keyv2 refresh
		await sleep(501);

		expect(await keyv1.get(data.key)).toBeUndefined();
		expect(await keyv2.get(data.key)).toEqual(0);

		// Background refresh, but stale value returned, while keyv1 is already updated
		expect(await cache.wrap(data.key, async () => 3)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(3);
		expect(await keyv2.get(data.key)).toEqual(3);

		// New value returned
		expect(await cache.wrap(data.key, async () => 4)).toEqual(3);
		expect(await keyv1.get(data.key)).toEqual(3);
		expect(await keyv2.get(data.key)).toEqual(3);
	});

	it("should respect refreshAllStores", async () => {
		cache = createCache({
			refreshThreshold,
			refreshAllStores: true,
			stores: [keyv1, keyv2],
		});

		// 1st call should be cached
		expect(await cache.wrap(data.key, async () => 0)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(0);
		expect(await keyv2.get(data.key)).toEqual(0);

		// Sleep 275ms, trigger keyv1 refresh
		await sleep(275);

		// Background refresh, but stale value returned, while keyv1 and keyv2 are all updated
		expect(await cache.wrap(data.key, async () => 1)).toEqual(0);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(1);

		// New value returned
		expect(await cache.wrap(data.key, async () => 2)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(1);

		// Sleep 525ms, keyv1 expired, but keyv2 was refreshed before, so keyv2 will not be refreshed, write back to keyv1 directly
		await sleep(525);

		expect(await keyv1.get(data.key)).toBeUndefined();
		expect(await keyv2.get(data.key)).toEqual(1);

		// No background refresh, write keyv2 value back to keyv1
		expect(await cache.wrap(data.key, async () => 3)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(1);
		expect(await keyv2.get(data.key)).toEqual(1);

		// Sleep 425ms, keyv1 expired, trigger keyv2 refresh
		await sleep(425);

		expect(await keyv1.get(data.key)).toBeUndefined();
		expect(await keyv2.get(data.key)).toEqual(1);

		// Background refresh, but stale value returned, while keyv1 and keyv2 are all updated
		expect(await cache.wrap(data.key, async () => 4)).toEqual(1);
		expect(await keyv1.get(data.key)).toEqual(4);
		expect(await keyv2.get(data.key)).toEqual(4);

		// New value returned
		expect(await cache.wrap(data.key, async () => 5)).toEqual(4);
		expect(await keyv1.get(data.key)).toEqual(4);
		expect(await keyv2.get(data.key)).toEqual(4);
	});
});

describe("preventStaleWrapWrites", () => {
	const pauseLoader = () => {
		const started = Promise.withResolvers<void>();
		const result = Promise.withResolvers<string>();
		const load = () => {
			started.resolve();
			return result.promise;
		};
		return { load, started: started.promise, finish: result.resolve };
	};

	const pauseNextSet = (store: Keyv) => {
		const started = Promise.withResolvers<void>();
		const resume = Promise.withResolvers<void>();
		const set = store.set.bind(store);
		vi.spyOn(store, "set").mockImplementationOnce(async (key, value, ttl) => {
			started.resolve();
			await resume.promise;
			return set(key, value, ttl);
		});
		return { started: started.promise, resume: resume.resolve };
	};

	it.each([
		{ enabled: true, expected: undefined },
		{ enabled: false, expected: "old" },
	])(
		"handles a cold fill after del when protection is $enabled",
		async ({ enabled, expected }) => {
			const cache = createCache(
				enabled ? { preventStaleWrapWrites: true } : {},
			);
			const loader = pauseLoader();
			const fill = cache.wrap("key", loader.load);

			await loader.started;
			await cache.del("key");
			loader.finish("old");
			await expect(fill).resolves.toBe("old");
			await expect(cache.get("key")).resolves.toBe(expected);
		},
	);

	it("shares a new loader after deletion while the old loader is active", async () => {
		const cache = createCache({ preventStaleWrapWrites: true });
		const oldLoader = pauseLoader();
		const old = cache.wrap("key", oldLoader.load);
		await oldLoader.started;
		await cache.del("key");

		const loader = vi.fn(() => "new");
		const first = cache.wrap("key", loader);
		const second = cache.wrap("key", loader);
		oldLoader.finish("old");
		await expect(Promise.all([old, first, second])).resolves.toEqual([
			"old",
			"new",
			"new",
		]);
		expect(loader).toHaveBeenCalledOnce();
		await expect(cache.get("key")).resolves.toBe("new");
	});

	it("discards an old refresh after set and emits only the new refresh", async () => {
		const cache = createCache({
			ttl: 60_000,
			refreshThreshold: 120_000,
			preventStaleWrapWrites: true,
		});
		const oldLoader = pauseLoader();
		const refreshed = vi.fn();
		cache.on("refresh", refreshed);
		await cache.set("key", "original");
		await expect(cache.wrap("key", oldLoader.load)).resolves.toBe("original");
		await oldLoader.started;
		await cache.set("key", "explicit");
		await expect(cache.wrap("key", () => "fresh")).resolves.toBe("explicit");

		oldLoader.finish("stale");
		await nextTurn();
		await expect(cache.get("key")).resolves.toBe("fresh");
		expect(refreshed.mock.calls).toEqual([[{ key: "key", value: "fresh" }]]);
	});

	it.each([false, true])(
		"orders an active store write before set with nonBlocking=%s",
		async (nonBlocking) => {
			const store = new Keyv();
			const cache = createCache({
				stores: [store],
				nonBlocking,
				preventStaleWrapWrites: true,
			});
			const write = pauseNextSet(store);
			const fill = cache.wrap("key", () => "old");
			await write.started;
			const update = cache.set("key", "new");
			const read = cache.wrap("key", () => "unexpected");
			if (nonBlocking) {
				await expect(fill).resolves.toBe("old");
				await expect(update).resolves.toBe("new");
			}
			await cache.set("other", "independent");
			await nextTurn();
			await expect(store.get("other")).resolves.toBe("independent");
			write.resume();
			await Promise.all([fill, update]);
			await expect(read).resolves.toBe("new");
			await expect(store.get("key")).resolves.toBe("new");
		},
	);

	it("waits for every tier before deletion even if one fill fails", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cache = createCache({
			stores: [primary, secondary],
			preventStaleWrapWrites: true,
		});
		const write = pauseNextSet(secondary);
		vi.spyOn(primary, "set").mockRejectedValueOnce(
			new Error("store unavailable"),
		);
		const failure = expect(cache.wrap("key", () => "old")).rejects.toThrow(
			"store unavailable",
		);
		await write.started;
		const deletion = cache.del("key");
		await nextTurn();
		write.resume();
		await Promise.all([failure, deletion]);
		await nextTurn();
		await expect(secondary.get("key")).resolves.toBeUndefined();
	});

	it.each([false, true])(
		"discards an old copy from a lower tier with nonBlocking=%s",
		async (nonBlocking) => {
			const primary = new Keyv();
			const secondary = new Keyv();
			const cache = createCache({
				stores: [primary, secondary],
				nonBlocking,
				preventStaleWrapWrites: true,
			});
			await secondary.set("key", "old");
			const started = Promise.withResolvers<void>();
			const resume = Promise.withResolvers<void>();
			const store = secondary.store;
			const get = store.get.bind(store);
			vi.spyOn(store, "get").mockImplementationOnce(async (key) => {
				const snapshot = await get(key);
				started.resolve();
				await resume.promise;
				return snapshot;
			});
			const read = cache.wrap("key", () => "unexpected");
			await started.promise;
			await cache.set("key", "new");
			resume.resolve();
			await expect(read).resolves.toBe("old");
			await nextTurn();
			await expect(primary.get("key")).resolves.toBe("new");
		},
	);
});
