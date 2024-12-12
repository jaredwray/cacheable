export class ListNode<T> {
	// eslint-disable-next-line @typescript-eslint/parameter-properties
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
			// eslint-disable-next-line no-multi-assign
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
		if (node.prev) {
			node.prev.next = node.next;
		}

		/* c8 ignore next 3 */
		if (node.next) {
			node.next.prev = node.prev;
		}

		// Update tail if necessary
		if (node === this.tail) {
			this.tail = node.prev;
		}

		// Move node to the front
		node.prev = undefined;
		node.next = this.head;
		if (this.head) {
			this.head.prev = node;
		}

		this.head = node;

		// If list was empty, update tail
		this.tail ||= node;
	}

	// Get the oldest node (tail)
	getOldest(): T | undefined {
		return this.tail ? this.tail.value : undefined;
	}

	// Remove the oldest node (tail)
	removeOldest(): T | undefined {
		/* c8 ignore next 3 */
		if (!this.tail) {
			return undefined;
		}

		const oldValue = this.tail.value;

		if (this.tail.prev) {
			this.tail = this.tail.prev;
			this.tail.next = undefined;
		/* c8 ignore next 4 */
		} else {
			// eslint-disable-next-line no-multi-assign
			this.head = this.tail = undefined;
		}

		// Remove the node from the map
		this.nodesMap.delete(oldValue);
		return oldValue;
	}

	get size(): number {
		return this.nodesMap.size;
	}
}
