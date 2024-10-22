export class ListNode {
	prev: ListNode | undefined = undefined;
	next: ListNode | undefined = undefined;
	private readonly _key: string;
	private readonly _namespace: string | undefined;

	constructor(key: string, namespace?: string) {
		this._key = key;
		this._namespace = namespace;
	}

	public get key(): string {
		return this._key;
	}

	public get namespace(): string | undefined {
		return this._namespace;
	}
}

export class DoublyLinkedList {
	private head: ListNode | undefined = undefined;
	private tail: ListNode | undefined = undefined;
	private readonly nodesMap = new Map<string, ListNode>();

	getNodeKey(key: string, namespace?: string): string {
		return namespace ? `${namespace}::${key}` : key;
	}

	// Add a new node to the front (most recently used)
	addToFront(key: string, namespace?: string): void {
		const nodeKey = this.getNodeKey(key, namespace);
		const newNode = new ListNode(key, namespace);

		if (this.head) {
			newNode.next = this.head;
			this.head.prev = newNode;
			this.head = newNode;
		} else {
			// eslint-disable-next-line no-multi-assign
			this.head = this.tail = newNode;
		}

		// Store the node reference in the map
		this.nodesMap.set(nodeKey, newNode);
	}

	// Move an existing node to the front (most recently used)
	moveToFront(key: string, namespace?: string): void {
		const nodeKey = this.getNodeKey(key, namespace);
		const node = this.nodesMap.get(nodeKey);
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
	getOldest(): ListNode | undefined {
		return this.tail;
	}

	// Remove the oldest node (tail)
	removeOldest(): ListNode | undefined {
		/* c8 ignore next 3 */
		if (!this.tail) {
			return undefined;
		}

		const oldValue = this.tail;

		if (this.tail.prev) {
			this.tail = this.tail.prev;
			this.tail.next = undefined;
		} else {
			/* c8 ignore next 3 */
			// eslint-disable-next-line no-multi-assign
			this.head = this.tail = undefined;
		}

		const nodeKey = this.getNodeKey(oldValue.key, oldValue.namespace);

		// Remove the node from the map
		this.nodesMap.delete(nodeKey);
		return oldValue;
	}

	get size(): number {
		return this.nodesMap.size;
	}
}
