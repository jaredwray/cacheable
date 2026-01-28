export class ListNode<T> {
	value: T;
	prev: ListNode<T> | undefined = undefined;
	next: ListNode<T> | undefined = undefined;

	constructor(value: T) {
		this.value = value;
	}
}

export class DoublyLinkedList<T> {
	private head: ListNode<T> | undefined = undefined;
	private tail: ListNode<T> | undefined = undefined;
	private readonly nodesMap = new Map<T, ListNode<T>>();

	// Add a new node to the front (most recently used)
	addToFront(value: T): void {
		const newNode = new ListNode(value);

		if (this.head) {
			newNode.next = this.head;
			this.head.prev = newNode;
			this.head = newNode;
		} else {
			this.head = this.tail = newNode;
		}

		// Store the node reference in the map
		this.nodesMap.set(value, newNode);
	}

	// Move an existing node to the front (most recently used)
	moveToFront(value: T): void {
		const node = this.nodesMap.get(value);
		if (!node || this.head === node) {
			return;
		} // Node doesn't exist or is already at the front

		// Remove the node from its current position
		/* v8 ignore next -- @preserve */
		if (node.prev) {
			node.prev.next = node.next;
		}

		/* v8 ignore next -- @preserve */
		if (node.next) {
			node.next.prev = node.prev;
		}

		// Update tail if necessary
		/* v8 ignore next -- @preserve */
		if (node === this.tail) {
			this.tail = node.prev;
		}

		// Move node to the front
		node.prev = undefined;
		node.next = this.head;
		/* v8 ignore next -- @preserve */
		if (this.head) {
			this.head.prev = node;
		}

		this.head = node;

		// If list was empty, update tail
		this.tail ??= node;
	}

	// Get the oldest node (tail)
	getOldest(): T | undefined {
		/* v8 ignore next -- @preserve */
		return this.tail ? this.tail.value : undefined;
	}

	// Remove the oldest node (tail)
	removeOldest(): T | undefined {
		/* v8 ignore next -- @preserve */
		if (!this.tail) {
			return undefined;
		}

		const oldValue = this.tail.value;

		/* v8 ignore next -- @preserve */
		if (this.tail.prev) {
			this.tail = this.tail.prev;
			this.tail.next = undefined;
		} else {
			/* v8 ignore next -- @preserve */
			this.head = this.tail = undefined;
		}

		// Remove the node from the map
		this.nodesMap.delete(oldValue);
		return oldValue;
	}

	// Remove a specific node by value
	remove(value: T): boolean {
		const node = this.nodesMap.get(value);
		if (!node) {
			return false;
		}

		// Update previous node's next pointer
		if (node.prev) {
			node.prev.next = node.next;
		} else {
			// Node is the head
			this.head = node.next;
		}

		// Update next node's prev pointer
		if (node.next) {
			node.next.prev = node.prev;
		} else {
			// Node is the tail
			this.tail = node.prev;
		}

		// Remove from the map
		this.nodesMap.delete(value);
		return true;
	}

	get size(): number {
		return this.nodesMap.size;
	}
}
