import { Keyv } from "keyv";
import { describe, expect, test, vi } from "vitest";
import { CacheTags } from "../src/cache-tags.js";
import { sleep } from "../src/sleep.js";

const createService = (namespace?: string) => {
	const store = new Keyv();
	return new CacheTags({ store, namespace });
};

describe("CacheTags", () => {
	test("isKeyFresh returns true after setKeyTags", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users"]);
		expect(await service.isKeyFresh("user:1")).toBe(true);
	});

	test("isKeyFresh returns false after invalidateTag", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users"]);
		await service.invalidateTag("users");
		expect(await service.isKeyFresh("user:1")).toBe(false);
	});

	test("invalidating one of multiple tags stales the key", async () => {
		const service = createService();
		await service.setKeyTags("post:1", ["posts", "authors", "feed"]);
		expect(await service.isKeyFresh("post:1")).toBe(true);
		await service.invalidateTag("authors");
		expect(await service.isKeyFresh("post:1")).toBe(false);
	});

	test("isKeyFresh on unknown key returns false", async () => {
		const service = createService();
		expect(await service.isKeyFresh("nope")).toBe(false);
	});

	test("removeKey then isKeyFresh returns false", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users"]);
		await service.removeKey("user:1");
		expect(await service.isKeyFresh("user:1")).toBe(false);
	});

	test("removeKeys deletes multiple snapshots in one batch", async () => {
		const service = createService();
		await service.setKeyTags("a", ["t"]);
		await service.setKeyTags("b", ["t"]);
		await service.removeKeys(["a", "b"]);
		expect(await service.isKeyFresh("a")).toBe(false);
		expect(await service.isKeyFresh("b")).toBe(false);
	});

	test("removeKeys with an empty list is a no-op", async () => {
		const service = createService();
		await service.setKeyTags("a", ["t"]);
		await service.removeKeys([]);
		expect(await service.isKeyFresh("a")).toBe(true);
	});

	test("invalidateTag returns the bumped tag", async () => {
		const service = createService();
		const result = await service.invalidateTag("users");
		expect(result).toEqual(["users"]);
	});

	test("invalidateTags returns all bumped tag names", async () => {
		const service = createService();
		const result = await service.invalidateTags(["a", "b", "c"]);
		expect(result).toEqual(["a", "b", "c"]);
	});

	test("invalidateTags with empty list is a no-op", async () => {
		const service = createService();
		await service.setKeyTags("k", ["t"]);
		const result = await service.invalidateTags([]);
		expect(result).toEqual([]);
		expect(await service.isKeyFresh("k")).toBe(true);
	});

	test("namespace isolation: tags do not leak across namespaces", async () => {
		const store = new Keyv();
		const ns1 = new CacheTags({ store, namespace: "ns1" });
		const ns2 = new CacheTags({ store, namespace: "ns2" });

		await ns1.setKeyTags("user:1", ["users"]);
		await ns2.setKeyTags("user:1", ["users"]);

		await ns1.invalidateTag("users");

		expect(await ns1.isKeyFresh("user:1")).toBe(false);
		expect(await ns2.isKeyFresh("user:1")).toBe(true);
	});

	test("ttl on setKeyTags expires key entry", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users"], { ttl: 50 });
		expect(await service.isKeyFresh("user:1")).toBe(true);
		await sleep(75);
		expect(await service.isKeyFresh("user:1")).toBe(false);
	});

	test("invalidation bumps remain in effect across re-checks", async () => {
		const service = createService();
		await service.setKeyTags("k", ["t"]);
		await service.invalidateTag("t");
		await service.invalidateTag("t");
		expect(await service.isKeyFresh("k")).toBe(false);
	});

	test("re-setting key after invalidation makes it fresh again", async () => {
		const service = createService();
		await service.setKeyTags("k", ["t"]);
		await service.invalidateTag("t");
		expect(await service.isKeyFresh("k")).toBe(false);
		await service.setKeyTags("k", ["t"]);
		expect(await service.isKeyFresh("k")).toBe(true);
	});

	test("getKeysByTag returns keys referencing the tag", async () => {
		const service = createService();
		await service.setKeyTags("a", ["x", "y"]);
		await service.setKeyTags("b", ["y"]);
		await service.setKeyTags("c", ["z"]);

		const xKeys = await service.getKeysByTag("x");
		const yKeys = (await service.getKeysByTag("y")).sort();
		const zKeys = await service.getKeysByTag("z");

		expect(xKeys).toEqual(["a"]);
		expect(yKeys).toEqual(["a", "b"]);
		expect(zKeys).toEqual(["c"]);
	});

	test("getKeysByTag returns empty when no keys reference tag", async () => {
		const service = createService();
		await service.setKeyTags("a", ["x"]);
		expect(await service.getKeysByTag("missing")).toEqual([]);
	});

	test("getKeysByTag skips tag-version entries during iteration", async () => {
		const service = createService();
		await service.setKeyTags("a", ["x"]);
		// invalidateTag writes a tag-version entry under the same namespace —
		// iterator should skip it because it doesn't match the key-entry prefix.
		await service.invalidateTag("x");
		await service.setKeyTags("a", ["x"]);
		expect(await service.getKeysByTag("x")).toEqual(["a"]);
	});

	test("getKeysByTag returns [] when store has no iterator", async () => {
		const store = new Keyv();
		// Simulate a store that does not expose iterator
		(store as unknown as { iterator?: unknown }).iterator = undefined;
		const service = new CacheTags({ store });
		await service.setKeyTags("a", ["x"]);
		expect(await service.getKeysByTag("x")).toEqual([]);
	});

	test("default namespace applied when not provided", async () => {
		const service = new CacheTags({ store: new Keyv() });
		expect(service.namespace).toBe("default");
	});

	test("exposes provided store", async () => {
		const store = new Keyv();
		const service = new CacheTags({ store });
		expect(service.store).toBe(store);
	});

	test("setKeyTags with no tags makes key trivially fresh", async () => {
		const service = createService();
		await service.setKeyTags("empty", []);
		expect(await service.isKeyFresh("empty")).toBe(true);
	});

	test("isKeyStale returns false for a key with no snapshot", async () => {
		const service = createService();
		expect(await service.isKeyStale("untagged")).toBe(false);
	});

	test("isKeyStale returns false for a fresh tagged key", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users"]);
		expect(await service.isKeyStale("user:1")).toBe(false);
	});

	test("isKeyStale returns true after invalidateTag", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users", "org:7"]);
		await service.invalidateTag("org:7");
		expect(await service.isKeyStale("user:1")).toBe(true);
	});

	test("isKeyStale returns false again after re-tagging the key", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users"]);
		await service.invalidateTag("users");
		await service.setKeyTags("user:1", ["users"]);
		expect(await service.isKeyStale("user:1")).toBe(false);
	});

	test("getTags returns the tags for a key", async () => {
		const service = createService();
		await service.setKeyTags("user:1", ["users", "org:7"]);
		expect(await service.getTags("user:1")).toEqual(["users", "org:7"]);
	});

	test("getTags returns undefined for an unknown key", async () => {
		const service = createService();
		expect(await service.getTags("nope")).toBeUndefined();
	});

	test("getTags returns empty array for a key tagged with no tags", async () => {
		const service = createService();
		await service.setKeyTags("empty", []);
		expect(await service.getTags("empty")).toEqual([]);
	});

	test("enabled defaults to true and can be toggled", () => {
		const service = createService();
		expect(service.enabled).toBe(true);
		service.enabled = false;
		expect(service.enabled).toBe(false);
	});

	test("disabled service treats read methods as no-ops", async () => {
		const service = new CacheTags({ store: new Keyv(), enabled: false });
		expect(await service.isKeyFresh("k")).toBe(true);
		expect(await service.isKeyStale("k")).toBe(false);
		expect(await service.getTags("k")).toBeUndefined();
		expect(await service.getKeysByTag("t")).toEqual([]);
		expect(await service.getStaleKeys(["k"])).toEqual([]);
	});

	test("disabled service skips snapshot removal", async () => {
		const service = createService();
		await service.setKeyTags("k", ["t"]);
		service.enabled = false;
		await service.removeKeys(["k"]);
		service.enabled = true;
		expect(await service.isKeyFresh("k")).toBe(true);
	});

	test("setKeyTags re-enables a disabled service", async () => {
		const service = new CacheTags({ store: new Keyv(), enabled: false });
		await service.setKeyTags("k", ["t"]);
		expect(service.enabled).toBe(true);
		expect(await service.isKeyFresh("k")).toBe(true);
	});

	test("invalidateTag and invalidateTags re-enable a disabled service", async () => {
		const single = new CacheTags({ store: new Keyv(), enabled: false });
		await single.invalidateTag("t");
		expect(single.enabled).toBe(true);

		const many = new CacheTags({ store: new Keyv(), enabled: false });
		await many.invalidateTags(["a", "b"]);
		expect(many.enabled).toBe(true);
	});

	test("invalidateTags with an empty list does not enable the service", async () => {
		const service = new CacheTags({ store: new Keyv(), enabled: false });
		await service.invalidateTags([]);
		expect(service.enabled).toBe(false);
	});

	test("getStaleKeys returns only stale keys", async () => {
		const service = createService();
		await service.setKeyTags("a", ["x"]);
		await service.setKeyTags("b", ["y"]);
		await service.setKeyTags("c", ["x", "z"]);
		await service.invalidateTag("x");
		const staleKeys = await service.getStaleKeys(["a", "b", "c", "untagged"]);
		expect(staleKeys.sort()).toEqual(["a", "c"]);
	});

	test("getStaleKeys with an empty list returns an empty array", async () => {
		const service = createService();
		expect(await service.getStaleKeys([])).toEqual([]);
	});

	test("non-blocking setKeyTags reports failures via onError", async () => {
		const store = new Keyv();
		const errors: unknown[] = [];
		const service = new CacheTags({
			store,
			onError: (error) => errors.push(error),
		});
		vi.spyOn(store, "set").mockRejectedValueOnce(new Error("down"));
		await service.setKeyTags("k", ["t"], { nonBlocking: true });
		await sleep(10);
		expect(errors).toHaveLength(1);
	});

	test("non-blocking removeKeys reports failures via onError", async () => {
		const store = new Keyv();
		const errors: unknown[] = [];
		const service = new CacheTags({
			store,
			onError: (error) => errors.push(error),
		});
		await service.setKeyTags("k", ["t"]);
		vi.spyOn(store, "deleteMany").mockRejectedValueOnce(new Error("down"));
		await service.removeKeys(["k"], { nonBlocking: true });
		await sleep(10);
		expect(errors).toHaveLength(1);
	});

	test("non-blocking failures without onError are swallowed", async () => {
		const store = new Keyv();
		const service = new CacheTags({ store });
		await service.setKeyTags("k", ["t"]);
		vi.spyOn(store, "deleteMany").mockRejectedValueOnce(new Error("down"));
		await service.removeKeys(["k"], { nonBlocking: true });
		await sleep(10);
		expect(await service.isKeyFresh("k")).toBe(true);
	});
});
