import { Keyv } from "keyv";
import { describe, expect, test } from "vitest";
import { CacheTagService } from "../src/cache-tag-service.js";
import { sleep } from "../src/sleep.js";

const createService = (namespace?: string) => {
	const store = new Keyv();
	return new CacheTagService({ store, namespace });
};

describe("CacheTagService", () => {
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
		const ns1 = new CacheTagService({ store, namespace: "ns1" });
		const ns2 = new CacheTagService({ store, namespace: "ns2" });

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
		const service = new CacheTagService({ store });
		await service.setKeyTags("a", ["x"]);
		expect(await service.getKeysByTag("x")).toEqual([]);
	});

	test("default namespace applied when not provided", async () => {
		const service = new CacheTagService({ store: new Keyv() });
		expect(service.namespace).toBe("default");
	});

	test("exposes provided store", async () => {
		const store = new Keyv();
		const service = new CacheTagService({ store });
		expect(service.store).toBe(store);
	});

	test("setKeyTags with no tags makes key trivially fresh", async () => {
		const service = createService();
		await service.setKeyTags("empty", []);
		expect(await service.isKeyFresh("empty")).toBe(true);
	});
});
