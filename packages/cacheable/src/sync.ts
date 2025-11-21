import { Hookified, type HookifiedOptions } from "hookified";
import type { Keyv } from "keyv";
import { type MessageProvider, Qified } from "qified";

/**
 * Events emitted by CacheableSync
 */
export enum CacheableSyncEvents {
	ERROR = "error",
	SET = "cache:set",
	DELETE = "cache:delete",
}

/**
 * Configuration options for CacheableSync
 */
export type CacheableSyncOptions = {
	/**
	 * Qified instance or message provider(s) for synchronization
	 */
	qified: Qified | MessageProvider | MessageProvider[];
	/**
	 * The namespace for sync events. It can be a string or a function that returns a string.
	 * When set, event names will be prefixed with the namespace (e.g., "my-namespace::cache:set")
	 */
	namespace?: string | (() => string);
} & HookifiedOptions;

export type CacheableSyncItem = {
	cacheId: string;
	key: string;
	value?: unknown;
	ttl?: number;
};

/**
 * CacheableSync provides synchronization capabilities for cacheable items
 * using message providers from Qified
 */
export class CacheableSync extends Hookified {
	private _qified: Qified = new Qified();
	private _namespace?: string | (() => string);
	private _storage?: Keyv;
	private _cacheId?: string;

	/**
	 * Creates an instance of CacheableSync
	 * @param options - Configuration options for CacheableSync
	 */
	constructor(options: CacheableSyncOptions) {
		super(options);

		this._namespace = options.namespace;
		this._qified = this.createQified(options.qified);
	}

	/**
	 * Gets the Qified instance used for synchronization
	 * @returns The Qified instance
	 */
	public get qified(): Qified {
		return this._qified;
	}

	/**
	 * Sets the Qified instance used for synchronization
	 * @param value - Either an existing Qified instance or MessageProvider(s)
	 */
	public set qified(value: Qified | MessageProvider | MessageProvider[]) {
		this._qified = this.createQified(value);
	}

	/**
	 * Gets the namespace for sync events
	 * @returns The namespace or undefined if not set
	 */
	public get namespace(): string | (() => string) | undefined {
		return this._namespace;
	}

	/**
	 * Sets the namespace for sync events and resubscribes if needed
	 * @param namespace - The namespace string or function
	 */
	public set namespace(namespace: string | (() => string) | undefined) {
		// If we have an active subscription, unsubscribe from old events first
		if (this._storage && this._cacheId) {
			const oldSetEvent = this.getPrefixedEvent(CacheableSyncEvents.SET);
			const oldDeleteEvent = this.getPrefixedEvent(CacheableSyncEvents.DELETE);

			void this._qified.unsubscribe(oldSetEvent);
			void this._qified.unsubscribe(oldDeleteEvent);
		}

		this._namespace = namespace;

		// Resubscribe with new namespace
		if (this._storage && this._cacheId) {
			this.subscribe(this._storage, this._cacheId);
		}
	}

	/**
	 * Publishes a cache event to all the cache instances
	 * @param data - The cache item data containing cacheId, key, value, and optional ttl
	 */
	public async publish(
		event: CacheableSyncEvents,
		data: CacheableSyncItem,
	): Promise<void> {
		const eventName = this.getPrefixedEvent(event);
		await this._qified.publish(eventName, {
			id: crypto.randomUUID(),
			data,
		});
	}

	/**
	 * Subscribes to sync events and updates the provided storage
	 * @param storage - The Keyv storage instance to update
	 * @param cacheId - The cache ID to identify this instance
	 */
	public subscribe(storage: Keyv, cacheId: string): void {
		// Store subscription state for potential resubscription
		this._storage = storage;
		this._cacheId = cacheId;

		const setEvent = this.getPrefixedEvent(CacheableSyncEvents.SET);
		const deleteEvent = this.getPrefixedEvent(CacheableSyncEvents.DELETE);

		// Subscribe to SET events to update local cache
		this._qified.subscribe(setEvent, {
			handler: async (message) => {
				const data = message.data as CacheableSyncItem;
				// Only process messages from other cache instances
				if (data.cacheId !== cacheId) {
					await storage.set(data.key, data.value, data.ttl);
				}
			},
		});

		// Subscribe to DELETE events to update local cache
		this._qified.subscribe(deleteEvent, {
			handler: async (message) => {
				const data = message.data as CacheableSyncItem;
				// Only process messages from other cache instances
				if (data.cacheId !== cacheId) {
					await storage.delete(data.key);
				}
			},
		});
	}

	/**
	 * Creates or returns a Qified instance from the provided value
	 * @param value - Either an existing Qified instance or MessageProvider(s)
	 * @returns A Qified instance configured with the provided message provider(s)
	 */
	public createQified(
		value: Qified | MessageProvider | MessageProvider[],
	): Qified {
		if (value instanceof Qified) {
			return value;
		}

		const providers = Array.isArray(value) ? value : [value];
		return new Qified({ messageProviders: providers });
	}

	/**
	 * Gets the namespace prefix to use for event names
	 * @returns The resolved namespace string or undefined
	 */
	private getNamespace(): string | undefined {
		if (typeof this._namespace === "function") {
			return this._namespace();
		}

		return this._namespace;
	}

	/**
	 * Prefixes an event name with the namespace if one is set
	 * @param event - The event to prefix
	 * @returns The prefixed event name or the original event
	 */
	private getPrefixedEvent(event: CacheableSyncEvents): string {
		const ns = this.getNamespace();
		return ns ? `${ns}::${event}` : event;
	}
}
