import { faker } from "@faker-js/faker";
import { Keyv } from "keyv";
import { describe, expect, test, vi } from "vitest";
import { Cacheable, CacheableEvents, CacheTags } from "../src/index.js";

const TAG_PREFIX = "--cacheable--tags--";

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
		let calls = 0;
		const options = { tags: ["entity:42"] };
		const getValue = async () => {
			calls++;
			return `value-${calls}`;
		};

		expect(await cacheable.getOrSet("k", getValue, options)).toEqual("value-1");
		expect(await cacheable.tags.getTags("k")).toEqual(["entity:42"]);
		expect(await cacheable.getOrSet("k", getValue, options)).toEqual("value-1");
		expect(calls).toBe(1);

		await cacheable.tags.invalidateTag("entity:42");
		expect(await cacheable.getOrSet("k", getValue, options)).toEqual("value-2");
		expect(calls).toBe(2);
		expect(await cacheable.tags.getTags("k")).toEqual(["entity:42"]);
	});

	test("getOrSet leaves a recomputed entry untagged when tags are omitted", async () => {
		const cacheable = new Cacheable({ tags: true });
		let calls = 0;
		const getValue = async () => {
			calls++;
			return `value-${calls}`;
		};

		await cacheable.getOrSet("k", getValue, { tags: ["entity:42"] });
		await cacheable.tags.invalidateTag("entity:42");

		expect(await cacheable.getOrSet("k", getValue)).toEqual("value-2");
		expect(calls).toBe(2);
		expect(await cacheable.tags.getTags("k")).toBeUndefined();

		await cacheable.tags.invalidateTag("entity:42");
		expect(await cacheable.getOrSet("k", getValue)).toEqual("value-2");
		expect(calls).toBe(2);
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
