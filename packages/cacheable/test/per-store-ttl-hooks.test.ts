import { sleep } from "@cacheable/utils";
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
});
