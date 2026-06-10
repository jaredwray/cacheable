import { EventEmitter } from "node:events";
import { describe, expect, test } from "vitest";
import { nodeCacheStatsEventMap, Stats } from "../src/stats.js";

type Listener = (...args: unknown[]) => void;

/** Minimal emitter with no detach methods (covers the no-op unsubscribe path). */
class BasicEmitter {
	protected listeners: Record<string, Listener[]> = {};

	on(event: string, listener: Listener): void {
		this.listeners[event] ??= [];
		this.listeners[event].push(listener);
	}

	emit(event: string, ...args: unknown[]): void {
		for (const listener of this.listeners[event] ?? []) {
			listener(...args);
		}
	}

	protected detach(event: string, listener: Listener): void {
		this.listeners[event] = (this.listeners[event] ?? []).filter(
			(l) => l !== listener,
		);
	}
}

/** Emitter exposing `off` (the preferred detach method). */
class OffEmitter extends BasicEmitter {
	off(event: string, listener: Listener): void {
		this.detach(event, listener);
	}
}

/** Emitter exposing only `removeListener` (Node EventEmitter compatibility). */
class RemoveListenerEmitter extends BasicEmitter {
	removeListener(event: string, listener: Listener): void {
		this.detach(event, listener);
	}
}

describe("cacheable stats", () => {
	test("should be able to instantiate", () => {
		const stats = new Stats();
		expect(stats).toBeDefined();
	});

	test("properties should be initialized", () => {
		const stats = new Stats();
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(0);
		expect(stats.gets).toBe(0);
		expect(stats.sets).toBe(0);
		expect(stats.deletes).toBe(0);
		expect(stats.clears).toBe(0);
		expect(stats.vsize).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.count).toBe(0);
	});

	test("should be able to enable stats", () => {
		const stats = new Stats({ enabled: true });
		expect(stats.enabled).toBe(true);
		stats.enabled = false;
		expect(stats.enabled).toBe(false);
	});

	test("should be able to increment stats", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits();
		stats.incrementMisses();
		stats.incrementGets();
		stats.incrementSets();
		stats.incrementDeletes();
		stats.incrementClears();
		stats.incrementVSize("foo");
		stats.incrementKSize("foo");
		stats.incrementCount();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.gets).toBe(1);
		expect(stats.sets).toBe(1);
		expect(stats.deletes).toBe(1);
		expect(stats.clears).toBe(1);
		expect(stats.vsize).toBe(6);
		expect(stats.ksize).toBe(6);
		expect(stats.count).toBe(1);
	});

	test("should be able to reset stats", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits();
		stats.incrementMisses();
		stats.incrementGets();
		stats.incrementSets();
		stats.incrementDeletes();
		stats.incrementClears();
		stats.incrementVSize("foo");
		stats.incrementKSize("foo");
		stats.incrementCount();
		stats.reset();
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(0);
		expect(stats.gets).toBe(0);
		expect(stats.sets).toBe(0);
		expect(stats.deletes).toBe(0);
		expect(stats.clears).toBe(0);
		expect(stats.vsize).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.count).toBe(0);
	});

	test("should be able to decrease certain stats", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementVSize("foo");
		stats.incrementKSize("foo");
		stats.incrementCount();
		expect(stats.vsize).toBe(6);
		expect(stats.ksize).toBe(6);
		expect(stats.count).toBe(1);
		stats.decreaseVSize("foo");
		stats.decreaseKSize("foo");
		stats.decreaseCount();
		expect(stats.vsize).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.count).toBe(0);
	});

	test("should not keep going if stats are disabled", () => {
		const stats = new Stats({ enabled: false });
		stats.incrementHits();
		stats.incrementMisses();
		stats.incrementGets();
		stats.incrementSets();
		stats.incrementDeletes();
		stats.incrementClears();
		stats.incrementVSize("foo");
		stats.incrementKSize("foo");
		stats.incrementCount();
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(0);
		expect(stats.gets).toBe(0);
		expect(stats.sets).toBe(0);
		expect(stats.deletes).toBe(0);
		expect(stats.clears).toBe(0);
		expect(stats.vsize).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.count).toBe(0);
		stats.enabled = true;
		stats.incrementHits();
		stats.incrementMisses();
		stats.incrementGets();
		stats.incrementSets();
		stats.incrementDeletes();
		stats.incrementClears();
		stats.incrementVSize("foo");
		stats.incrementKSize("foo");
		stats.incrementCount();
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.gets).toBe(1);
		expect(stats.sets).toBe(1);
		expect(stats.deletes).toBe(1);
		expect(stats.clears).toBe(1);
		expect(stats.vsize).toBe(6);
		expect(stats.ksize).toBe(6);
		expect(stats.count).toBe(1);
		stats.enabled = false;
		stats.decreaseKSize("foo");
		stats.decreaseVSize("foo");
		stats.decreaseCount();
		expect(stats.vsize).toBe(6);
		expect(stats.ksize).toBe(6);
		expect(stats.count).toBe(1);
		stats.resetStoreValues();
		expect(stats.vsize).toBe(0);
		expect(stats.ksize).toBe(0);
		expect(stats.count).toBe(0);
	});
	test("should get the rough size of the stats object", () => {
		const stats = new Stats();
		expect(stats.roughSizeOfObject(true)).toBeGreaterThan(0);
		expect(stats.roughSizeOfObject("wow")).toBeGreaterThan(0);
		expect(stats.roughSizeOfObject(123)).toBeGreaterThan(0);
		expect(stats.roughSizeOfObject({ foo: "bar" })).toBeGreaterThan(0);
		expect(stats.roughSizeOfObject([1, 2, 3])).toBeGreaterThan(0);
	});
	test("set the count property", () => {
		const stats = new Stats();
		stats.setCount(10);
		expect(stats.count).toBe(0);
		stats.enabled = true;
		stats.setCount(10);
		expect(stats.count).toBe(10);
	});

	test("should handle null values in roughSizeOfObject", () => {
		const stats = new Stats();
		const size = stats.roughSizeOfObject(null);
		expect(size).toBe(4); // null is treated as 4 bytes
	});

	test("should handle undefined values in roughSizeOfObject", () => {
		const stats = new Stats();
		const size = stats.roughSizeOfObject(undefined);
		expect(size).toBe(4); // undefined is treated as 4 bytes
	});

	test("should handle objects with null properties", () => {
		const stats = new Stats();
		const obj = { foo: "bar", nullValue: null, undefinedValue: undefined };
		const size = stats.roughSizeOfObject(obj);
		expect(size).toBeGreaterThan(0);
	});

	test("should handle circular references without infinite loop", () => {
		const stats = new Stats();
		// biome-ignore lint/suspicious/noExplicitAny: needed for circular reference test
		const obj: any = { foo: "bar" };
		obj.self = obj; // Create circular reference
		const size = stats.roughSizeOfObject(obj);
		expect(size).toBeGreaterThan(0);
		expect(size).toBeLessThan(Number.POSITIVE_INFINITY);
	});

	test("should handle nested circular references", () => {
		const stats = new Stats();
		// biome-ignore lint/suspicious/noExplicitAny: needed for circular reference test
		const obj1: any = { name: "obj1" };
		// biome-ignore lint/suspicious/noExplicitAny: needed for circular reference test
		const obj2: any = { name: "obj2" };
		obj1.ref = obj2;
		obj2.ref = obj1; // Create circular reference between two objects
		const size = stats.roughSizeOfObject(obj1);
		expect(size).toBeGreaterThan(0);
		expect(size).toBeLessThan(Number.POSITIVE_INFINITY);
	});

	test("should handle arrays with circular references", () => {
		const stats = new Stats();
		// biome-ignore lint/suspicious/noExplicitAny: needed for circular reference test
		const arr: any[] = [1, 2, 3];
		arr.push(arr); // Create circular reference in array
		const size = stats.roughSizeOfObject(arr);
		expect(size).toBeGreaterThan(0);
		expect(size).toBeLessThan(Number.POSITIVE_INFINITY);
	});
});

describe("stats unified increment/decrement", () => {
	test("should increment and decrement a field by amount", () => {
		const stats = new Stats({ enabled: true });
		stats.increment("hits", 5);
		stats.increment("misses");
		stats.decrement("hits", 2);
		expect(stats.hits).toBe(3);
		expect(stats.misses).toBe(1);
	});

	test("named increments accept an optional amount", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits(3);
		stats.incrementCount(4);
		stats.decreaseCount(1);
		expect(stats.hits).toBe(3);
		expect(stats.count).toBe(3);
	});

	test("should be a no-op when disabled", () => {
		const stats = new Stats();
		stats.increment("hits", 5);
		stats.decrement("count", 2);
		expect(stats.hits).toBe(0);
		expect(stats.count).toBe(0);
	});
});

describe("stats computed rates", () => {
	test("should return 0 rates with no lookups", () => {
		const stats = new Stats({ enabled: true });
		expect(stats.hitRate).toBe(0);
		expect(stats.missRate).toBe(0);
	});

	test("should compute hit and miss rates", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits(3);
		stats.incrementMisses(1);
		expect(stats.hitRate).toBe(0.75);
		expect(stats.missRate).toBe(0.25);
	});
});

describe("stats timestamps", () => {
	test("should be undefined initially", () => {
		const stats = new Stats({ enabled: true });
		expect(stats.lastUpdated).toBeUndefined();
		expect(stats.lastReset).toBeUndefined();
	});

	test("should set lastUpdated on an enabled mutation", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits();
		expect(typeof stats.lastUpdated).toBe("number");
	});

	test("should not set lastUpdated when disabled", () => {
		const stats = new Stats();
		stats.incrementHits();
		expect(stats.lastUpdated).toBeUndefined();
	});

	test("reset and clear should set lastReset and clear lastUpdated", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits();
		stats.reset();
		expect(typeof stats.lastReset).toBe("number");
		expect(stats.lastUpdated).toBeUndefined();

		stats.incrementHits();
		stats.clear();
		expect(typeof stats.lastReset).toBe("number");
		expect(stats.lastUpdated).toBeUndefined();
	});
});

describe("stats enable/disable/clear", () => {
	test("enable and disable should toggle tracking", () => {
		const stats = new Stats();
		expect(stats.enabled).toBe(false);
		stats.enable();
		expect(stats.enabled).toBe(true);
		stats.incrementHits();
		expect(stats.hits).toBe(1);
		stats.disable();
		stats.incrementHits();
		expect(stats.hits).toBe(1);
	});

	test("clear should reset all counters", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits();
		stats.incrementSets();
		stats.clear();
		expect(stats.hits).toBe(0);
		expect(stats.sets).toBe(0);
	});
});

describe("stats snapshot", () => {
	test("toJSON should include counters, rates, and timestamps", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits(2);
		stats.incrementMisses(1);
		stats.incrementSets();
		stats.incrementVSize("foo");
		stats.incrementKSize("foo");
		stats.incrementCount();

		const json = stats.toJSON();
		expect(json.enabled).toBe(true);
		expect(json.hits).toBe(2);
		expect(json.misses).toBe(1);
		expect(json.sets).toBe(1);
		expect(json.vsize).toBe(6);
		expect(json.ksize).toBe(6);
		expect(json.count).toBe(1);
		expect(json.hitRate).toBeCloseTo(2 / 3);
		expect(json.missRate).toBeCloseTo(1 / 3);
		expect(typeof json.lastUpdated).toBe("number");
	});

	test("snapshot should equal toJSON", () => {
		const stats = new Stats({ enabled: true });
		stats.incrementHits();
		expect(stats.snapshot()).toEqual(stats.toJSON());
	});
});

describe("stats event subscription", () => {
	test("should track events from a Node EventEmitter with a custom map", () => {
		const emitter = new EventEmitter();
		const stats = new Stats({ enabled: true });
		stats.subscribe(emitter, {
			"cache:hit": ["hits", "gets"],
			"cache:miss": ["misses", "gets"],
		});

		emitter.emit("cache:hit", { key: "a", value: 1, store: "primary" });
		emitter.emit("cache:miss", { key: "b", store: "primary" });
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.gets).toBe(2);

		stats.unsubscribe();
		emitter.emit("cache:hit", { key: "c", value: 2 });
		expect(stats.hits).toBe(1);
	});

	test("should track node-cache events and reset on flush_stats", () => {
		const emitter = new OffEmitter();
		const stats = new Stats({ enabled: true });
		stats.subscribe(emitter, nodeCacheStatsEventMap);

		emitter.emit("set", "key", "value");
		emitter.emit("del", "key");
		emitter.emit("flush");
		expect(stats.sets).toBe(1);
		expect(stats.deletes).toBe(1);
		expect(stats.clears).toBe(1);

		emitter.emit("flush_stats");
		expect(stats.sets).toBe(0);
		expect(stats.deletes).toBe(0);
		expect(stats.clears).toBe(0);
		expect(typeof stats.lastReset).toBe("number");
	});

	test("should not run event handlers when disabled", () => {
		const emitter = new OffEmitter();
		const stats = new Stats();
		let calls = 0;
		stats.subscribe(emitter, {
			ping: () => {
				calls += 1;
			},
		});

		emitter.emit("ping");
		expect(calls).toBe(0);

		stats.enable();
		emitter.emit("ping");
		expect(calls).toBe(1);
	});

	test("should support string, array, and function map entries", () => {
		const emitter = new OffEmitter();
		const stats = new Stats({ enabled: true });
		stats.subscribe(emitter, {
			single: "hits",
			multiple: ["misses", "gets"],
			handler: (s) => {
				s.incrementSets();
			},
		});

		emitter.emit("single");
		emitter.emit("multiple");
		emitter.emit("handler");
		expect(stats.hits).toBe(1);
		expect(stats.misses).toBe(1);
		expect(stats.gets).toBe(1);
		expect(stats.sets).toBe(1);
	});

	test("should detach via removeListener when off is absent", () => {
		const emitter = new RemoveListenerEmitter();
		const stats = new Stats({ enabled: true });
		stats.subscribe(emitter, nodeCacheStatsEventMap);

		emitter.emit("set", "key", "value");
		expect(stats.sets).toBe(1);
		stats.unsubscribe(emitter);
		emitter.emit("set", "key", "value");
		expect(stats.sets).toBe(1);
	});

	test("should not throw unsubscribing an emitter without detach methods", () => {
		const emitter = new BasicEmitter();
		const stats = new Stats({ enabled: true });
		stats.subscribe(emitter, { ping: "hits" });
		expect(() => {
			stats.unsubscribe();
		}).not.toThrow();
	});

	test("should selectively unsubscribe a single emitter", () => {
		const first = new OffEmitter();
		const second = new OffEmitter();
		const stats = new Stats({ enabled: true });
		stats.subscribe(first, { a: "hits" });
		stats.subscribe(second, { b: "misses" });

		stats.unsubscribe(first);
		first.emit("a");
		second.emit("b");
		expect(stats.hits).toBe(0);
		expect(stats.misses).toBe(1);
	});

	test("should respect enabled state for subscriptions", () => {
		const emitter = new OffEmitter();
		const stats = new Stats();
		stats.subscribe(emitter, { hit: "hits" });

		emitter.emit("hit");
		expect(stats.hits).toBe(0);
		stats.enable();
		emitter.emit("hit");
		expect(stats.hits).toBe(1);
	});

	test("should not auto-subscribe when eventMap is omitted", () => {
		const emitter = new EventEmitter();
		const stats = new Stats({ enabled: true, emitter });
		emitter.emit("set");
		expect(stats.sets).toBe(0);
	});

	test("should auto-subscribe from the constructor with a custom map", () => {
		const emitter = new OffEmitter();
		const stats = new Stats({
			enabled: true,
			emitter,
			eventMap: nodeCacheStatsEventMap,
		});
		emitter.emit("set", "key", "value");
		expect(stats.sets).toBe(1);
	});
});
