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

	/**
	 * Creates an instance of CacheableSync
	 * @param options - Configuration options for CacheableSync
	 */
	constructor(options: CacheableSyncOptions) {
		super(options);

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
	 * Publishes a cache event to all the cache instances
	 * @param data - The cache item data containing cacheId, key, value, and optional ttl
	 */
	public async publish(
		event: CacheableSyncEvents,
		data: CacheableSyncItem,
	): Promise<void> {
		await this._qified.publish(event, {
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
		// Subscribe to SET events to update local cache
		this._qified.subscribe(CacheableSyncEvents.SET, {
			handler: async (message) => {
				const data = message.data as CacheableSyncItem;
				// Only process messages from other cache instances
				if (data.cacheId !== cacheId) {
					await storage.set(data.key, data.value, data.ttl);
				}
			},
		});

		// Subscribe to DELETE events to update local cache
		this._qified.subscribe(CacheableSyncEvents.DELETE, {
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
}
