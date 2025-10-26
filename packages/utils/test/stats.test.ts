import { describe, expect, test } from "vitest";
import { Stats } from "../src/stats.js";

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
