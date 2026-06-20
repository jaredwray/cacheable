import { getTtlFromExpires, sleep } from "@cacheable/utils";
import { Keyv } from "keyv";
import { MemoryMessageProvider } from "qified";
import { describe, expect, test } from "vitest";
import { Cacheable, CacheableHooks } from "../src/index.js";
import { CacheableSyncEvents } from "../src/sync.js";

describe("per-store ttl via the BEFORE_SET hook", () => {
	test("sets a different ttl per store with an object", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50, secondary: 500 };
		});
		await cacheable.set("key", "value");
		expect(await primary.get("key")).toEqual("value");
		expect(await secondary.get("key")).toEqual("value");
		await sleep(120);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("value");
		await sleep(450);
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("resolves shorthand strings in a per-store object", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: "60ms", secondary: "400ms" };
		});
		await cacheable.set("key", "value");
		await sleep(120);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("value");
	});

	test("omitting the secondary field falls back to the secondary default", {
		timeout: 3000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv({ ttl: 1000 });
		const cacheable = new Cacheable({ primary, secondary, ttl: 60_000 });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50 };
		});
		await cacheable.set("key", "value");
		await sleep(120);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("value");
		await sleep(1000);
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("omitting the primary field falls back to the primary cascade", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, ttl: 100 });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { secondary: 500 };
		});
		await cacheable.set("key", "value");
		await sleep(150);
		// Primary used the instance ttl (100ms); secondary used the explicit 500ms
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("value");
		await sleep(450);
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("an empty object uses each store's own cascade", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv({ ttl: 400 });
		const cacheable = new Cacheable({ primary, secondary, ttl: 80 });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = {};
		});
		await cacheable.set("key", "value");
		await sleep(120);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("value");
		await sleep(400);
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("clearing the ttl with null clears it instead of cascading", {
		timeout: 2000,
	}, async () => {
		// typeof null === "object", so the hook must not treat null as a per-store object.
		// With no store defaults, null clears the ttl (like undefined) rather than cascading to
		// the instance ttl, so the value never expires.
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, ttl: 100 });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = null;
		});
		await cacheable.set("key", "value");
		await sleep(150);
		// The instance ttl (100ms) is ignored; both copies survive
		expect(await primary.get("key")).toEqual("value");
		expect(await secondary.get("key")).toEqual("value");
	});

	test("a hook setting a negative ttl is treated as no ttl", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = -5;
		});
		await cacheable.set("key", "value");
		await sleep(50);
		// The invalid negative ttl is treated as no ttl rather than expiring immediately
		expect(await primary.get("key")).toEqual("value");
		expect(await secondary.get("key")).toEqual("value");
	});

	test("a scalar applies to both stores", { timeout: 2000 }, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = 100;
		});
		await cacheable.set("key", "value");
		await sleep(150);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("a scalar equal to the resolved primary still overrides both stores", {
		timeout: 2000,
	}, async () => {
		// Without write-tracking this would be treated as "no override" and the
		// secondary would keep its own 1000ms default.
		const primary = new Keyv();
		const secondary = new Keyv({ ttl: 1000 });
		const cacheable = new Cacheable({ primary, secondary, ttl: 100 });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = 100; // identical to the resolved primary ttl
		});
		await cacheable.set("key", "value");
		await sleep(150);
		// Both stores expired: the secondary followed the override, not its default
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("maxTtl caps each store after the hook", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, maxTtl: 100 });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50, secondary: 5000 };
		});
		await cacheable.set("key", "value");
		await sleep(150);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("ignores the secondary field when there is no secondary store", {
		timeout: 2000,
	}, async () => {
		const cacheable = new Cacheable();
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50, secondary: 500 };
		});
		await cacheable.set("key", "value");
		expect(await cacheable.get("key")).toEqual("value");
		await sleep(120);
		expect(await cacheable.get("key")).toBeUndefined();
	});

	test("keeps the tag snapshot alive for the longest-lived store copy", {
		timeout: 3000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, tags: true });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 2000, secondary: 100 };
		});
		await cacheable.set("key", "value", { tags: ["t1"] });
		await sleep(250);
		// Secondary copy expired, primary copy still live
		expect(await primary.get("key")).toEqual("value");
		expect(await cacheable.get("key")).toEqual("value");
		await cacheable.tags.invalidateTag("t1");
		expect(await cacheable.get("key")).toBeUndefined();
	});

	test("keeps the tag snapshot immortal when one store never expires", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv(); // no default ttl: the secondary copy never expires
		const cacheable = new Cacheable({ primary, secondary, tags: true });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50 }; // primary expires, secondary has no ttl
		});
		await cacheable.set("key", "value", { tags: ["t1"] });
		await sleep(120);
		// Primary copy expired; the immortal secondary copy still serves the value
		expect(await primary.get("key")).toBeUndefined();
		expect(await cacheable.get("key")).toEqual("value");
		// The tag snapshot is immortal too, so invalidation still reaches the surviving copy
		await cacheable.tags.invalidateTag("t1");
		expect(await cacheable.get("key")).toBeUndefined();
	});

	test("keeps the tag snapshot immortal when a per-store ttl is 0", {
		timeout: 2000,
	}, async () => {
		// ttl 0 means the copy never expires, so the snapshot must stay immortal too.
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, tags: true });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 0, secondary: 100 }; // primary immortal, secondary 100ms
		});
		await cacheable.set("key", "value", { tags: ["t1"] });
		await sleep(150);
		// Secondary copy expired; the immortal primary copy survives
		expect(await primary.get("key")).toEqual("value");
		expect(await cacheable.get("key")).toEqual("value");
		// The snapshot is immortal too, so invalidation still reaches the surviving copy
		await cacheable.tags.invalidateTag("t1");
		expect(await cacheable.get("key")).toBeUndefined();
	});

	test("AFTER_SET observes the effective primary ttl as a number", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		let afterSetTtl: unknown;
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50, secondary: 500 };
		});
		cacheable.onHook(CacheableHooks.AFTER_SET, (item) => {
			afterSetTtl = item.ttl;
		});
		await cacheable.set("key", "value");
		expect(typeof afterSetTtl).toBe("number");
		expect(afterSetTtl).toBe(50);
	});

	test("leaving the ttl untouched keeps each store's cascade", {
		timeout: 3000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv({ ttl: 1000 });
		const cacheable = new Cacheable({ primary, secondary, ttl: 100 });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.value = "changed";
		});
		await cacheable.set("key", "value");
		// Value mutation still works
		expect(await primary.get("key")).toEqual("changed");
		await sleep(150);
		// Primary used the instance ttl (100ms), secondary kept its 1000ms default
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("changed");
	});

	test("sync publishes the effective primary number for a per-store override", async () => {
		const provider = new MemoryMessageProvider({ id: "per-store-hook" });
		const secondary = new Keyv();
		const cacheable = new Cacheable({ secondary, sync: { qified: provider } });
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50, secondary: 500 };
		});
		// biome-ignore lint/suspicious/noExplicitAny: Message type not exported from qified
		let received: any;
		await cacheable.sync?.qified.subscribe(CacheableSyncEvents.SET, {
			handler: async (message) => {
				received = message;
			},
		});
		await new Promise((resolve) => setTimeout(resolve, 50));
		await cacheable.set("key", "value");
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(received?.data.key).toBe("key");
		expect(typeof received?.data.ttl).toBe("number");
		expect(received?.data.ttl).toBe(50);
	});
});

describe("per-store ttl via setMany / BEFORE_SET_MANY", () => {
	test("supports a per-store object per item at the operation level", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		await cacheable.setMany([
			{ key: "key", value: "value", ttl: { primary: 50, secondary: 500 } },
		]);
		await sleep(120);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("value");
		await sleep(450);
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("a BEFORE_SET_MANY hook can set a per-store object on an item", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		cacheable.onHook(CacheableHooks.BEFORE_SET_MANY, (items) => {
			items[0].ttl = { primary: 50, secondary: 500 };
		});
		await cacheable.setMany([{ key: "key", value: "value" }]);
		await sleep(120);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toEqual("value");
	});

	test("a scalar item ttl applies to both stores", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		await cacheable.setMany([{ key: "key", value: "value", ttl: 100 }]);
		await sleep(150);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("caps each store's per-store item ttl with maxTtl", {
		timeout: 2000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, maxTtl: 100 });
		await cacheable.setMany([
			{ key: "key", value: "value", ttl: { primary: 50, secondary: 5000 } },
		]);
		await sleep(150);
		expect(await primary.get("key")).toBeUndefined();
		expect(await secondary.get("key")).toBeUndefined();
	});

	test("keeps the tag snapshot for the longest-lived store copy", {
		timeout: 3000,
	}, async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary, tags: true });
		await cacheable.setMany([
			{
				key: "key",
				value: "value",
				ttl: { primary: 2000, secondary: 100 },
				tags: ["t1"],
			},
		]);
		await sleep(250);
		expect(await primary.get("key")).toEqual("value");
		expect(await cacheable.get("key")).toEqual("value");
		await cacheable.tags.invalidateTag("t1");
		expect(await cacheable.get("key")).toBeUndefined();
	});

	test("sync publishes the primary number for a per-store item", async () => {
		const provider = new MemoryMessageProvider({ id: "per-store-many" });
		const cacheable = new Cacheable({ sync: { qified: provider } });
		// biome-ignore lint/suspicious/noExplicitAny: Message type not exported from qified
		const received: any[] = [];
		await cacheable.sync?.qified.subscribe(CacheableSyncEvents.SET, {
			handler: async (message) => {
				received.push(message);
			},
		});
		await new Promise((resolve) => setTimeout(resolve, 50));
		await cacheable.setMany([
			{ key: "key", value: "value", ttl: { primary: 50, secondary: 500 } },
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(received).toHaveLength(1);
		expect(typeof received[0]?.data.ttl).toBe("number");
		expect(received[0]?.data.ttl).toBe(50);
	});

	test("sync publishes the cascaded primary ttl when an item omits primary", async () => {
		const provider = new MemoryMessageProvider({
			id: "per-store-many-cascade",
		});
		const cacheable = new Cacheable({ ttl: 100, sync: { qified: provider } });
		// biome-ignore lint/suspicious/noExplicitAny: Message type not exported from qified
		let received: any;
		await cacheable.sync?.qified.subscribe(CacheableSyncEvents.SET, {
			handler: async (message) => {
				received = message;
			},
		});
		await new Promise((resolve) => setTimeout(resolve, 50));
		// Primary omitted -> cascades to the instance ttl (100), which is what is written and synced
		await cacheable.setMany([
			{ key: "key", value: "value", ttl: { secondary: 500 } },
		]);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(received?.data.ttl).toBe(100);
	});
});

describe("hook payload behavior", () => {
	test("AFTER_SET sees the effective primary number, AFTER_SET_MANY sees the item as passed", async () => {
		const primary = new Keyv();
		const secondary = new Keyv();
		const cacheable = new Cacheable({ primary, secondary });
		let afterSetTtl: unknown;
		let afterSetManyTtl: unknown;
		cacheable.onHook(CacheableHooks.BEFORE_SET, (item) => {
			item.ttl = { primary: 50, secondary: 500 };
		});
		cacheable.onHook(CacheableHooks.AFTER_SET, (item) => {
			afterSetTtl = item.ttl;
		});
		cacheable.onHook(CacheableHooks.BEFORE_SET_MANY, (items) => {
			items[0].ttl = { primary: 50, secondary: 500 };
		});
		cacheable.onHook(CacheableHooks.AFTER_SET_MANY, (items) => {
			afterSetManyTtl = items[0].ttl;
		});
		await cacheable.set("a", "1");
		await cacheable.setMany([{ key: "b", value: "2" }]);
		// Single-key set normalizes item.ttl to the effective primary number for AFTER_SET
		expect(afterSetTtl).toBe(50);
		// setMany leaves the caller's items untouched, so AFTER_SET_MANY still sees the object
		expect(afterSetManyTtl).toEqual({ primary: 50, secondary: 500 });
	});

	test("BEFORE_SECONDARY_SETS_PRIMARY honors only the primary field of a per-store object", {
		timeout: 2000,
	}, async () => {
		const secondary = new Keyv({ ttl: 1000 });
		const cacheable = new Cacheable({ secondary });
		cacheable.onHook(CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY, (item) => {
			// JS callers can still assign a per-store object here; only `.primary` is applied to
			// the primary write (the type forbids this for TS users).
			(item as { ttl: unknown }).ttl = { primary: 50, secondary: 999 };
		});
		await cacheable.set("key", "value");
		// Drop the primary copy so the next read backfills from the secondary
		await cacheable.primary.delete("key");
		await cacheable.get("key");
		const raw = await cacheable.primary.getRaw("key");
		expect(raw?.value).toEqual("value");
		const ttl = getTtlFromExpires(raw?.expires ?? undefined);
		expect(ttl).toBeGreaterThan(0);
		expect(ttl).toBeLessThanOrEqual(50);
	});
});
