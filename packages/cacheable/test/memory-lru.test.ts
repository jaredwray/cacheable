import {describe, test, expect} from 'vitest';
import {DoublyLinkedList} from '../src/memory-lru.js';

describe('DoublyLinkedList', () => {
	test('should be able to add and get string items', () => {
		const lru = new DoublyLinkedList();
		lru.addToFront('key1');
		lru.addToFront('key2');
		lru.addToFront('key3');
		expect(lru.getOldest()?.key).toBe('key1');
	});
	test('should be able to do namespace with keys', () => {
		const lru = new DoublyLinkedList();
		lru.addToFront('key1', 'namespace1');
		lru.addToFront('key2', 'namespace2');
		lru.addToFront('key3', 'namespace1');
		expect(lru.getOldest()?.key).toBe('key1');
		lru.moveToFront('key1', 'namespace1');
		expect(lru.getOldest()?.key).toBe('key2');
		expect(lru.getOldest()?.namespace).toBe('namespace2');
		lru.removeOldest();
		expect(lru.getOldest()?.key).toBe('key3');
	});

	test('remove oldest should return undefined if empty', () => {
		const lru = new DoublyLinkedList();
		expect(lru.removeOldest()).toBe(undefined);
	});

	test('should remove the last one if only one item', () => {
		const lru = new DoublyLinkedList();
		lru.addToFront('key1');
		expect(lru.removeOldest()?.key).toBe('key1');
		expect(lru.removeOldest()).toBe(undefined);
	});

	test('should be able to remove items', () => {
		const lru = new DoublyLinkedList();
		lru.addToFront('key1');
		lru.addToFront('key2');
		lru.addToFront('key3');
		lru.remove('key1');
		expect(lru.getOldest()?.key).toBe('key2');
		expect(lru.size).toBe(2);
	});

	test('should be able to remove head item', () => {
		const lru = new DoublyLinkedList();
		lru.addToFront('key1');
		lru.addToFront('key2');
		lru.addToFront('key3');
		lru.remove('key3');
		expect(lru.getOldest()?.key).toBe('key1');
		expect(lru.size).toBe(2);
	});
});
