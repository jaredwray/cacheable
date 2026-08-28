import { faker } from "@faker-js/faker";
import { Keyv } from "keyv";
import { describe, expect, test, vi } from "vitest";
import {
	Cacheable,
	CacheableEvents,
	CacheableHooks,
	CacheTags,
} from "../src/index.js";

const TAG_PREFIX = "--cacheable--tags--";

type Deferred = {
	promise: Promise<void>;
	resolve: () => void;
};

const createDeferred = (): Deferred => {
	let resolve: () => void = () => {};
	const promise = new Promise<void>((promiseResolve) => {
		resolve = promiseResolve;
	});
	return { promise, resolve };
};

const nextEventLoopTurn = () =>
	new Promise<void>((resolve) => {
		setImmediate(resolve);
	});

describe("cacheable tags", () => {
	test("tag service is created by default and disabled until enabled", () => {
		const cacheable = new Cacheable();
		expect(cacheable.tags).toBeInstanceOf(CacheTags);
		expect(cacheable.tags.enabled).toBe(false);
		// same instance on repeat access
		expect(cacheable.tags).toBe(cacheable.tags);
	});

	test("tags option enables the service in the constructor", () => {
		const cacheable = new Cacheable({ tags: true });
		expect(cacheable.tags.enabled).toBe(true);
	});

	test("tags are ignored while the service is disabled", async () => {
		const cacheable = new Cacheable();
		await cacheable.set("k", "v", { tags: ["t"] });
		expect(cacheable.tags.enabled).toBe(false);
		expect(await cacheable.tags.invalidateTag("t")).toEqual([]);
		// no snapshot was written and the value is untouched
		cacheable.tags.enabled = true;
		expect(await cacheable.tags.getTags("k")).toBeUndefined();
		expect(await cacheable.get("k")).toEqual("v");
	});

	test("tag service is recreated when stores change and keeps enabled state", () => {
		const cacheable = new Cacheable({ tags: true });
		const first = cacheable.tags;
		cacheable.primary = new Keyv();
		expect(cacheable.tags).not.toBe(first);
		expect(cacheable.tags.enabled).toBe(true);

		const second = cacheable.tags;
		cacheable.secondary = new Keyv();
		expect(cacheable.tags).not.toBe(second);

		const third = cacheable.tags;
		cacheable.setPrimary(new Keyv());
		expect(cacheable.tags).not.toBe(third);

		const fourth = cacheable.tags;
		cacheable.setSecondary(new Keyv());
		expect(cacheable.tags).not.toBe(fourth);
		expect(cacheable.tags.enabled).toBe(true);
	});

	test("tags service uses the secondary store when one is set", () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		expect(cacheable.tags.store).toBe(secondary);
		const primaryOnly = new Cacheable();
		expect(primaryOnly.tags.store).toBe(primaryOnly.primary);
	});

	test("set with tags then invalidateTag makes the entry a miss", async () => {
		const cacheable = new Cacheable({ tags: true });
		const key = faker.string.uuid();
		const value = faker.string.alpha(10);
		await cacheable.set(key, value, { tags: ["entity:42"] });
		expect(await cacheable.get(key)).toEqual(value);
		await cacheable.tags.invalidateTag("entity:42");
		expect(await cacheable.get(key)).toBeUndefined();
	});

	test("getOrSet associates tags with a newly computed entry", async () => {
		const cacheable = new Cacheable({ tags: true });
		const key = faker.string.uuid();
		let calls = 0;
		const options = { tags: ["entity:42"] };
		const getValue = async () => {
			calls++;
			return `value-${calls}`;
		};

		expect(await cacheable.getOrSet(key, getValue, options)).toEqual("value-1");
		expect(await cacheable.tags.getTags(key)).toEqual(["entity:42"]);
		expect(await cacheable.getOrSet(key, getValue, options)).toEqual("value-1");
		expect(calls).toBe(1);

		await cacheable.tags.invalidateTag("entity:42");
		expect(await cacheable.getOrSet(key, getValue, options)).toEqual("value-2");
		expect(calls).toBe(2);
		expect(await cacheable.tags.getTags(key)).toEqual(["entity:42"]);
	});

	test("getOrSet leaves a recomputed entry untagged when tags are omitted", async () => {
		const cacheable = new Cacheable({ tags: true });
		const key = faker.string.uuid();
		let calls = 0;
		const getValue = async () => {
			calls++;
			return `value-${calls}`;
		};

		await cacheable.getOrSet(key, getValue, { tags: ["entity:42"] });
		await cacheable.tags.invalidateTag("entity:42");

		expect(await cacheable.getOrSet(key, getValue)).toEqual("value-2");
		expect(calls).toBe(2);
		expect(await cacheable.tags.getTags(key)).toBeUndefined();

		await cacheable.tags.invalidateTag("entity:42");
		expect(await cacheable.getOrSet(key, getValue)).toEqual("value-2");
		expect(calls).toBe(2);
	});

	test("a scheduled secondary backfill cannot overwrite a newer getOrSet value", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, tags: true });
		const key = "scheduled-backfill-race";
		const tag = "entity:42";

		await cacheable.set(key, "stale", { tags: [tag] });
		await primary.delete(key);

		const staleBackfillGate = createDeferred();
		const staleBackfillStarted = createDeferred();
		const staleBackfillReleased = createDeferred();
		cacheable.onHook(
			CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY,
			async (item) => {
				if (item.key === key && item.value === "stale") {
					staleBackfillStarted.resolve();
					await staleBackfillGate.promise;
					staleBackfillReleased.resolve();
				}
			},
		);

		const freshPrimaryWritten = createDeferred();
		const originalSet = primary.set.bind(primary);
		vi.spyOn(primary, "set").mockImplementation(
			async (setKey: string, value: unknown, ttl?: number) => {
				const result = await originalSet(setKey, value, ttl);
				if (setKey === key && value === "fresh") {
					freshPrimaryWritten.resolve();
				}
				return result;
			},
		);

		// The secondary value is fresh when this non-blocking backfill is scheduled.
		expect(await cacheable.get(key, { nonBlocking: true })).toEqual("stale");
		await staleBackfillStarted.promise;

		await cacheable.tags.invalidateTag(tag);
		const getValue = vi.fn(async () => "fresh");
		const recompute = cacheable.getOrSet(key, getValue, {
			tags: [tag],
			nonBlocking: true,
		});

		// Allow cancellation to write immediately, or serialization to wait for the gate.
		await Promise.race([freshPrimaryWritten.promise, nextEventLoopTurn()]);
		staleBackfillGate.resolve();

		expect(await recompute).toEqual("fresh");
		await Promise.all([
			freshPrimaryWritten.promise,
			staleBackfillReleased.promise,
		]);
		await nextEventLoopTurn();

		expect(getValue).toHaveBeenCalledTimes(1);
		expect(await primary.get(key)).toEqual("fresh");
		expect(await secondary.get(key)).toEqual("fresh");
		expect(await cacheable.get(key)).toEqual("fresh");
	});

	test("getOrSet waits for an in-flight secondary backfill write", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, tags: true });
		const key = "writing-backfill-race";
		const tag = "entity:42";

		await cacheable.set(key, "stale", { tags: [tag] });
		await primary.delete(key);

		const staleWriteGate = createDeferred();
		const staleWriteStarted = createDeferred();
		const staleWriteFinished = createDeferred();
		const originalPrimarySet = primary.set.bind(primary);
		vi.spyOn(primary, "set").mockImplementation(
			async (setKey: string, value: unknown, ttl?: number) => {
				const result = await originalPrimarySet(setKey, value, ttl);
				if (setKey === key && value === "stale") {
					staleWriteStarted.resolve();
					await staleWriteGate.promise;
					staleWriteFinished.resolve();
				}
				return result;
			},
		);

		expect(await cacheable.get(key, { nonBlocking: true })).toEqual("stale");
		await staleWriteStarted.promise;
		expect(await primary.get(key)).toEqual("stale");

		await cacheable.tags.invalidateTag(tag);
		const getValue = vi.fn(async () => "fresh");
		let recomputeSettled = false;
		const recompute = cacheable
			.getOrSet(key, getValue, { tags: [tag], nonBlocking: true })
			.finally(() => {
				recomputeSettled = true;
			});

		await nextEventLoopTurn();
		const settledBeforeRelease = recomputeSettled;
		staleWriteGate.resolve();

		expect(await recompute).toEqual("fresh");
		await staleWriteFinished.promise;
		expect(settledBeforeRelease).toBe(false);
		expect(getValue).toHaveBeenCalledTimes(1);
		expect(await primary.get(key)).toEqual("fresh");
		expect(await secondary.get(key)).toEqual("fresh");
		expect(await cacheable.get(key)).toEqual("fresh");
	});

	test("a rejected non-blocking secondary read releases its controller", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const key = "rejected-secondary-read";
		const error = new Error("secondary read failed");
		const errors = vi.fn();
		cacheable.on(CacheableEvents.ERROR, errors);
		vi.spyOn(secondary, "getRaw").mockRejectedValueOnce(error);

		expect(await cacheable.get(key, { nonBlocking: true })).toBeUndefined();
		expect(errors).toHaveBeenCalledWith(error);

		let setSettled = false;
		const setResult = cacheable.set(key, "fresh").finally(() => {
			setSettled = true;
		});
		await nextEventLoopTurn();

		expect(setSettled).toBe(true);
		expect(await setResult).toBe(true);
		expect(await cacheable.get(key)).toEqual("fresh");
	});

	test("a non-blocking secondary miss releases its controller", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const key = "secondary-miss";
		const misses = vi.fn();
		cacheable.on(CacheableEvents.CACHE_MISS, misses);

		expect(await cacheable.get(key, { nonBlocking: true })).toBeUndefined();
		expect(misses).toHaveBeenNthCalledWith(1, { key, store: "primary" });
		expect(misses).toHaveBeenNthCalledWith(2, { key, store: "secondary" });

		expect(await cacheable.set(key, "fresh")).toBe(true);
		expect(await cacheable.get(key)).toEqual("fresh");
	});

	test("a rejected non-blocking batched secondary read releases its controllers", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary });
		const keys = ["rejected-secondary-many-a", "rejected-secondary-many-b"];
		const error = new Error("secondary batched read failed");
		const errors = vi.fn();
		cacheable.on(CacheableEvents.ERROR, errors);
		vi.spyOn(secondary, "getManyRaw").mockRejectedValueOnce(error);

		expect(await cacheable.getMany(keys, { nonBlocking: true })).toEqual([
			undefined,
			undefined,
		]);
		expect(errors).toHaveBeenCalledWith(error);

		let setManySettled = false;
		const setManyResult = cacheable
			.setMany([
				{ key: keys[0], value: "fresh-a" },
				{ key: keys[1], value: "fresh-b" },
			])
			.finally(() => {
				setManySettled = true;
			});
		await nextEventLoopTurn();

		expect(setManySettled).toBe(true);
		expect(await setManyResult).toBe(true);
		expect(await cacheable.getMany(keys)).toEqual(["fresh-a", "fresh-b"]);
	});

	test("an authoritative set cancels a backfill before its secondary read returns", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		const key = "cancelled-pending-backfill";

		await secondary.set(key, "stale");
		const secondaryReadGate = createDeferred();
		const secondaryReadStarted = createDeferred();
		const originalSecondaryGetRaw = secondary.getRaw.bind(secondary);
		vi.spyOn(secondary, "getRaw").mockImplementation(
			async (readKey: string) => {
				const result = await originalSecondaryGetRaw(readKey);
				if (readKey === key) {
					secondaryReadStarted.resolve();
					await secondaryReadGate.promise;
				}
				return result;
			},
		);
		const backfillHook = vi.fn();
		cacheable.onHook(
			CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY,
			backfillHook,
		);

		const oldRead = cacheable.get(key, { nonBlocking: true });
		await secondaryReadStarted.promise;
		expect(await cacheable.set(key, "fresh")).toBe(true);
		secondaryReadGate.resolve();

		expect(await oldRead).toEqual("stale");
		await nextEventLoopTurn();
		expect(backfillHook).not.toHaveBeenCalled();
		expect(await primary.get(key)).toEqual("fresh");
		expect(await secondary.get(key)).toEqual("fresh");
		expect(await cacheable.get(key)).toEqual("fresh");
	});

	test("a rejected non-blocking primary backfill releases its controller", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		const key = "rejected-primary-backfill";
		const error = new Error("primary backfill failed");

		await secondary.set(key, "stale");
		const backfillErrorEmitted = createDeferred();
		const errors = vi.fn((emittedError: unknown) => {
			if (emittedError === error) {
				backfillErrorEmitted.resolve();
			}
		});
		cacheable.on(CacheableEvents.ERROR, errors);

		const originalPrimarySet = primary.set.bind(primary);
		let shouldRejectBackfill = true;
		vi.spyOn(primary, "set").mockImplementation(
			async (setKey: string, value: unknown, ttl?: number) => {
				if (setKey === key && value === "stale" && shouldRejectBackfill) {
					shouldRejectBackfill = false;
					throw error;
				}
				return originalPrimarySet(setKey, value, ttl);
			},
		);

		expect(await cacheable.get(key, { nonBlocking: true })).toEqual("stale");
		await backfillErrorEmitted.promise;
		expect(errors).toHaveBeenCalledWith(error);

		let setSettled = false;
		const setResult = cacheable.set(key, "fresh").finally(() => {
			setSettled = true;
		});
		await nextEventLoopTurn();

		expect(setSettled).toBe(true);
		expect(await setResult).toBe(true);
		expect(await primary.get(key)).toEqual("fresh");
		expect(await secondary.get(key)).toEqual("fresh");
		expect(await cacheable.get(key)).toEqual("fresh");
	});

	test("a delayed stale secondary delete cannot erase a recomputed value", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({
			primary,
			secondary,
			nonBlocking: true,
			tags: true,
		});
		const key = "secondary-delete-race";
		const tag = "entity:42";

		await cacheable.set(key, "stale", {
			nonBlocking: false,
			tags: [tag],
		});
		await cacheable.tags.invalidateTag(tag);

		const staleDeleteGate = createDeferred();
		const staleDeleteStarted = createDeferred();
		const staleDeleteFinished = createDeferred();
		const originalDelete = secondary.delete.bind(secondary);
		vi.spyOn(secondary, "delete").mockImplementation(
			async (deleteKey: string | string[]) => {
				if (deleteKey === key) {
					staleDeleteStarted.resolve();
					await staleDeleteGate.promise;
					const result = await originalDelete(deleteKey);
					staleDeleteFinished.resolve();
					return result;
				}
				return originalDelete(deleteKey);
			},
		);

		const freshSecondaryWritten = createDeferred();
		const originalSecondarySet = secondary.set.bind(secondary);
		vi.spyOn(secondary, "set").mockImplementation(
			async (setKey: string, value: unknown, ttl?: number) => {
				const result = await originalSecondarySet(setKey, value, ttl);
				if (setKey === key && value === "fresh") {
					freshSecondaryWritten.resolve();
				}
				return result;
			},
		);

		const recompute = cacheable.getOrSet(key, async () => "fresh", {
			tags: [tag],
		});
		await staleDeleteStarted.promise;
		await Promise.race([freshSecondaryWritten.promise, nextEventLoopTurn()]);
		staleDeleteGate.resolve();

		expect(await recompute).toEqual("fresh");
		await Promise.all([
			staleDeleteFinished.promise,
			freshSecondaryWritten.promise,
		]);
		await nextEventLoopTurn();

		expect(await secondary.get(key)).toEqual("fresh");
		expect(await cacheable.get(key)).toEqual("fresh");
	});

	test("a delayed stale snapshot delete cannot erase a newer tag snapshot", async () => {
		const primary = new Keyv();
		const cacheable = new Cacheable({
			primary,
			nonBlocking: true,
			tags: true,
		});
		const key = "snapshot-delete-race";
		const tag = "entity:42";
		const snapshotKey = `${TAG_PREFIX}:default:key:${key}`;

		await cacheable.set(key, "stale", {
			nonBlocking: false,
			tags: [tag],
		});
		await cacheable.tags.invalidateTag(tag);

		const staleSnapshotDeleteGate = createDeferred();
		const staleSnapshotDeleteStarted = createDeferred();
		const staleSnapshotDeleteFinished = createDeferred();
		const originalDeleteMany = primary.deleteMany.bind(primary);
		let shouldDelaySnapshotDelete = true;
		vi.spyOn(primary, "deleteMany").mockImplementation(
			async (keys: string[]) => {
				if (shouldDelaySnapshotDelete && keys.includes(snapshotKey)) {
					shouldDelaySnapshotDelete = false;
					staleSnapshotDeleteStarted.resolve();
					await staleSnapshotDeleteGate.promise;
					const result = await originalDeleteMany(keys);
					staleSnapshotDeleteFinished.resolve();
					return result;
				}
				return originalDeleteMany(keys);
			},
		);

		const freshSnapshotWritten = createDeferred();
		const originalPrimarySet = primary.set.bind(primary);
		vi.spyOn(primary, "set").mockImplementation(
			async (setKey: string, value: unknown, ttl?: number) => {
				const result = await originalPrimarySet(setKey, value, ttl);
				if (setKey === snapshotKey) {
					freshSnapshotWritten.resolve();
				}
				return result;
			},
		);

		const recompute = cacheable.getOrSet(key, async () => "fresh", {
			tags: [tag],
		});
		await staleSnapshotDeleteStarted.promise;
		await Promise.race([freshSnapshotWritten.promise, nextEventLoopTurn()]);
		staleSnapshotDeleteGate.resolve();

		expect(await recompute).toEqual("fresh");
		await Promise.all([
			staleSnapshotDeleteFinished.promise,
			freshSnapshotWritten.promise,
		]);
		await nextEventLoopTurn();

		expect(await cacheable.tags.getTags(key)).toEqual([tag]);
		await cacheable.tags.invalidateTag(tag);
		expect(await cacheable.get(key)).toBeUndefined();
	});

	test("set still supports ttl as the third argument", async () => {
		const cacheable = new Cacheable();
		const key = faker.string.uuid();
		await cacheable.set(key, "value", 1000);
		const raw = await cacheable.getRaw(key);
		expect(raw?.expires).toBeGreaterThan(Date.now());
	});

	test("set supports ttl inside the options object", async () => {
		const cacheable = new Cacheable({ tags: true });
		const key = faker.string.uuid();
		await cacheable.set(key, "value", { ttl: "1h", tags: ["a"] });
		const raw = await cacheable.getRaw(key);
		expect(raw?.expires).toBeGreaterThan(Date.now());
	});

	test("invalidateTag only affects entries with that tag", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("tagged", "one", { tags: ["posts"] });
		await cacheable.set("other", "two", { tags: ["users"] });
		await cacheable.set("untagged", "three");
		await cacheable.tags.invalidateTag("posts");
		expect(await cacheable.get("tagged")).toBeUndefined();
		expect(await cacheable.get("other")).toEqual("two");
		expect(await cacheable.get("untagged")).toEqual("three");
	});

	test("invalidateTags invalidates multiple tags at once", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("a", 1, { tags: ["x"] });
		await cacheable.set("b", 2, { tags: ["y"] });
		await cacheable.set("c", 3, { tags: ["z"] });
		await cacheable.tags.invalidateTags(["x", "y"]);
		expect(await cacheable.getMany(["a", "b", "c"])).toEqual([
			undefined,
			undefined,
			3,
		]);
	});

	test("stale entries are removed from the stores on get", async () => {
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary, tags: true });
		const key = faker.string.uuid();
		await cacheable.set(key, "value", { tags: ["t"] });
		await cacheable.tags.invalidateTag("t");
		expect(await cacheable.get(key)).toBeUndefined();
		expect(await cacheable.primary.has(key)).toBe(false);
		expect(await secondary.has(key)).toBe(false);
		expect(await cacheable.tags.getTags(key)).toBeUndefined();
	});

	test("getTags returns the tags for a key", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { tags: ["a", "b"] });
		expect(await cacheable.tags.getTags("k")).toEqual(["a", "b"]);
		expect(await cacheable.tags.getTags("missing")).toBeUndefined();
	});

	test("re-setting a key without tags clears its previous snapshot", async () => {
		const cacheable = new Cacheable({ tags: true });
		const key = faker.string.uuid();
		await cacheable.set(key, "tagged", { tags: ["t"] });
		await cacheable.set(key, "untagged");
		await cacheable.tags.invalidateTag("t");
		expect(await cacheable.get(key)).toEqual("untagged");
		expect(await cacheable.tags.getTags(key)).toBeUndefined();
	});

	test("set with an empty tags array does not write a snapshot", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { tags: [] });
		expect(await cacheable.tags.getTags("k")).toBeUndefined();
		expect(await cacheable.get("k")).toEqual("v");
	});

	test("delete removes the tag snapshot", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { tags: ["t"] });
		await cacheable.delete("k");
		expect(await cacheable.tags.getTags("k")).toBeUndefined();
	});

	test("deleteMany removes the tag snapshots", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.setMany([
			{ key: "a", value: 1, tags: ["t"] },
			{ key: "b", value: 2, tags: ["t"] },
		]);
		await cacheable.deleteMany(["a", "b"]);
		expect(await cacheable.tags.getTags("a")).toBeUndefined();
		expect(await cacheable.tags.getTags("b")).toBeUndefined();
	});

	test("setMany supports tags per item and getMany honors invalidation", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.setMany([
			{ key: "a", value: 1, tags: ["x"] },
			{ key: "b", value: 2, tags: ["y"] },
			{ key: "c", value: 3 },
		]);
		// all entries are fresh before invalidation
		expect(await cacheable.getMany(["a", "b", "c"])).toEqual([1, 2, 3]);
		await cacheable.tags.invalidateTag("x");
		expect(await cacheable.getMany(["a", "b", "c"])).toEqual([undefined, 2, 3]);
	});

	test("getMany only backfills tag-fresh secondary values in non-blocking mode", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, tags: true });
		const staleKey = "stale-many";
		const freshKey = "fresh-many";

		await cacheable.setMany([
			{ key: staleKey, value: "stale", tags: ["stale-tag"] },
			{ key: freshKey, value: "fresh", tags: ["fresh-tag"] },
		]);
		await primary.deleteMany([staleKey, freshKey]);
		await cacheable.tags.invalidateTag("stale-tag");

		let releaseStaleBackfill: () => void = () => {};
		const staleBackfillGate = new Promise<void>((resolve) => {
			releaseStaleBackfill = resolve;
		});
		const originalSet = primary.set.bind(primary);
		vi.spyOn(primary, "set").mockImplementation(
			async (setKey: string, value: unknown, ttl?: number) => {
				if (setKey === staleKey && value === "stale") {
					await staleBackfillGate;
				}

				return originalSet(setKey, value, ttl);
			},
		);

		expect(
			await cacheable.getMany([staleKey, freshKey], { nonBlocking: true }),
		).toEqual([undefined, "fresh"]);

		releaseStaleBackfill();
		await new Promise<void>((resolve) => {
			setImmediate(resolve);
		});

		expect(await primary.get(staleKey)).toBeUndefined();
		expect(await primary.get(freshKey)).toEqual("fresh");
		expect(await cacheable.get(staleKey)).toBeUndefined();
		expect(await cacheable.get(freshKey)).toEqual("fresh");
	});

	test("setMany with tags while disabled stores values without tracking", async () => {
		const cacheable = new Cacheable();
		await cacheable.setMany([{ key: "a", value: 1, tags: ["t"] }]);
		expect(cacheable.tags.enabled).toBe(false);
		expect(await cacheable.get("a")).toEqual(1);
		cacheable.tags.enabled = true;
		expect(await cacheable.tags.getTags("a")).toBeUndefined();
	});

	test("setMany clears previous snapshots for items set without tags", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("a", "tagged", { tags: ["t"] });
		await cacheable.setMany([{ key: "a", value: "untagged" }]);
		await cacheable.tags.invalidateTag("t");
		expect(await cacheable.get("a")).toEqual("untagged");
	});

	test("take returns undefined for a stale entry", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { tags: ["t"] });
		await cacheable.tags.invalidateTag("t");
		expect(await cacheable.take("k")).toBeUndefined();
	});

	test("invalidations are shared across instances via the secondary store", async () => {
		const secondary = new Keyv();
		const writer = new Cacheable({ secondary, tags: true });
		const reader = new Cacheable({ secondary, tags: true });
		const key = faker.string.uuid();

		await writer.set(key, "value", { tags: ["entity:42"] });
		// reader pulls the value from the shared secondary into its own primary
		expect(await reader.get(key)).toEqual("value");
		expect(await reader.primary.has(key)).toBe(true);

		await writer.tags.invalidateTag("entity:42");
		expect(await reader.get(key)).toBeUndefined();
		// the stale copy is purged from the reader's primary as well
		expect(await reader.primary.has(key)).toBe(false);
	});

	test("tag snapshots expire with the entry ttl", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { ttl: 30, tags: ["t"] });
		expect(await cacheable.tags.getTags("k")).toEqual(["t"]);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(await cacheable.get("k")).toBeUndefined();
		expect(await cacheable.tags.getTags("k")).toBeUndefined();
	});

	test("set with tags in non-blocking mode still records the snapshot", async () => {
		const cacheable = new Cacheable({ nonBlocking: true, tags: true });
		await cacheable.set("k", "v", { tags: ["t"] });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(await cacheable.tags.getTags("k")).toEqual(["t"]);
		await cacheable.tags.invalidateTag("t");
		expect(await cacheable.get("k")).toBeUndefined();
	});

	test("set honors a per-call nonBlocking override", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { nonBlocking: true, tags: ["t"] });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(await cacheable.get("k")).toEqual("v");
		expect(await cacheable.tags.getTags("k")).toEqual(["t"]);
	});

	test("delete in non-blocking mode removes the tag snapshot", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { tags: ["t"] });
		cacheable.nonBlocking = true;
		await cacheable.delete("k");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(await cacheable.tags.getTags("k")).toBeUndefined();
	});

	test("setMany with tags in non-blocking mode records snapshots", async () => {
		const cacheable = new Cacheable({ nonBlocking: true, tags: true });
		await cacheable.setMany([{ key: "a", value: 1, tags: ["t"] }]);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(await cacheable.tags.getTags("a")).toEqual(["t"]);
	});

	test("emits an error when a non-blocking snapshot write fails", async () => {
		const cacheable = new Cacheable({ nonBlocking: true, tags: true });
		const store = cacheable.tags.store;
		const originalSet = store.set.bind(store);
		vi.spyOn(store, "set").mockImplementation(
			async (key: string, value: unknown, ttl?: number) => {
				if (key.startsWith(TAG_PREFIX)) {
					throw new Error("tag store down");
				}

				return originalSet(key, value, ttl);
			},
		);
		let errored: unknown;
		cacheable.on(CacheableEvents.ERROR, (error: unknown) => {
			errored = error;
		});
		await cacheable.set("k", "v", { tags: ["t"] });
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(errored).toBeInstanceOf(Error);
	});

	test("emits an error when a non-blocking snapshot removal fails", async () => {
		const cacheable = new Cacheable({ nonBlocking: true, tags: true });
		vi.spyOn(cacheable.tags.store, "deleteMany").mockRejectedValueOnce(
			new Error("tag store down"),
		);
		let errored: unknown;
		cacheable.on(CacheableEvents.ERROR, (error: unknown) => {
			errored = error;
		});
		await cacheable.delete("k");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(errored).toBeInstanceOf(Error);
	});

	test("clear removes values, snapshots, and tag versions", async () => {
		const cacheable = new Cacheable({ tags: true });
		await cacheable.set("k", "v", { tags: ["t"] });
		await cacheable.tags.invalidateTag("t");
		await cacheable.clear();
		await cacheable.set("k", "v2", { tags: ["t"] });
		expect(await cacheable.get("k")).toEqual("v2");
	});
});
