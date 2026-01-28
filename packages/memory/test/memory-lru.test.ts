import { describe, expect, test } from "vitest";
import { DoublyLinkedList } from "../src/memory-lru.js";

describe("DoublyLinkedList", () => {
	describe("remove()", () => {
		test("should return false when removing non-existent node", () => {
			const list = new DoublyLinkedList<string>();
			expect(list.remove("nonexistent")).toBe(false);
		});

		test("should remove single node", () => {
			const list = new DoublyLinkedList<string>();
			list.addToFront("a");
			expect(list.size).toBe(1);
			expect(list.remove("a")).toBe(true);
			expect(list.size).toBe(0);
			expect(list.getOldest()).toBeUndefined();
		});

		test("should remove head node", () => {
			const list = new DoublyLinkedList<string>();
			list.addToFront("c");
			list.addToFront("b");
			list.addToFront("a"); // a is head

			expect(list.remove("a")).toBe(true);
			expect(list.size).toBe(2);
			expect(list.getOldest()).toBe("c");
		});

		test("should remove tail node", () => {
			const list = new DoublyLinkedList<string>();
			list.addToFront("c"); // c is tail
			list.addToFront("b");
			list.addToFront("a");

			expect(list.remove("c")).toBe(true);
			expect(list.size).toBe(2);
			expect(list.getOldest()).toBe("b");
		});

		test("should remove middle node", () => {
			const list = new DoublyLinkedList<string>();
			list.addToFront("c");
			list.addToFront("b"); // middle
			list.addToFront("a");

			expect(list.remove("b")).toBe(true);
			expect(list.size).toBe(2);
			expect(list.getOldest()).toBe("c");
		});

		test("should be idempotent - removing same value twice", () => {
			const list = new DoublyLinkedList<string>();
			list.addToFront("a");

			expect(list.remove("a")).toBe(true);
			expect(list.remove("a")).toBe(false);
			expect(list.size).toBe(0);
		});

		test("should maintain list integrity after multiple removes", () => {
			const list = new DoublyLinkedList<string>();
			list.addToFront("e");
			list.addToFront("d");
			list.addToFront("c");
			list.addToFront("b");
			list.addToFront("a");

			// Remove middle
			expect(list.remove("c")).toBe(true);
			expect(list.size).toBe(4);

			// Remove head
			expect(list.remove("a")).toBe(true);
			expect(list.size).toBe(3);

			// Remove tail
			expect(list.remove("e")).toBe(true);
			expect(list.size).toBe(2);

			// Verify remaining nodes
			expect(list.getOldest()).toBe("d");
			expect(list.removeOldest()).toBe("d");
			expect(list.getOldest()).toBe("b");
		});
	});
});
