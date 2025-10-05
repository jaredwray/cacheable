import type { CacheableItem } from "@cacheable/utils";
import { Hookified } from "hookified";
import type { Message, MessageProvider } from "qified";
import { Qified } from "qified";

// Minimal interface for Cacheable to avoid circular dependencies
export interface CacheableInterface {
	cacheId: string;
	set<T>(key: string, value: T, ttl?: number | string): Promise<boolean>;
	setMany(items: CacheableItem[]): Promise<boolean>;
	delete(key: string): Promise<boolean>;
	deleteMany(keys: string[]): Promise<boolean>;
	clear(): Promise<void>;
}

export enum CacheSyncEvents {
	SYNC_PUBLISHED = "sync:published",
	SYNC_RECEIVED = "sync:received",
	SYNC_APPLIED = "sync:applied",
	ERROR = "error",
}

export enum CacheSyncHooks {
	BEFORE_PUBLISH = "BEFORE_PUBLISH",
	AFTER_PUBLISH = "AFTER_PUBLISH",
	BEFORE_APPLY = "BEFORE_APPLY",
	AFTER_APPLY = "AFTER_APPLY",
}

export type SyncOperation =
	| "set"
	| "setMany"
	| "delete"
	| "deleteMany"
	| "clear";

export type SyncMessage = {
	operation: SyncOperation;
	timestamp: number;
	instanceId: string;
	data?: {
		key?: string;
		value?: unknown;
		ttl?: number | string;
		keys?: string[];
		items?: CacheableItem[];
	};
};

export type CacheSyncOptions = {
	/**
	 * The Cacheable instance to sync
	 */
	cacheable: CacheableInterface;
	/**
	 * Optional Qified instance. If not provided, a new one will be created with the message providers.
	 */
	qified?: Qified;
	/**
	 * Message providers to use. Only used if qified is not provided.
	 */
	messageProviders?: MessageProvider[];
	/**
	 * The topic to use for syncing. Defaults to 'cache:sync:{cacheId}'
	 */
	topic?: string;
	/**
	 * Whether to publish local cache operations to other instances. Defaults to true.
	 */
	enablePublish?: boolean;
	/**
	 * Whether to subscribe to cache operations from other instances. Defaults to true.
	 */
	enableSubscribe?: boolean;
	/**
	 * Which operations to sync. Defaults to all operations.
	 */
	syncOperations?: SyncOperation[];
	/**
	 * Unique identifier for this cache instance. Defaults to a random ID.
	 */
	instanceId?: string;
};

export class CacheSync extends Hookified {
	private _cacheable: CacheableInterface;
	private _qified: Qified;
	private _topic: string;
	private _enablePublish: boolean;
	private _enableSubscribe: boolean;
	private _syncOperations: SyncOperation[];
	private _instanceId: string;
	private _isSubscribed = false;

	constructor(options: CacheSyncOptions) {
		super();

		this._cacheable = options.cacheable;
		this._instanceId =
			options.instanceId ?? Math.random().toString(36).slice(2);
		this._topic = options.topic ?? `cache:sync:${this._cacheable.cacheId}`;
		this._enablePublish = options.enablePublish ?? true;
		this._enableSubscribe = options.enableSubscribe ?? true;
		this._syncOperations = options.syncOperations ?? [
			"set",
			"setMany",
			"delete",
			"deleteMany",
			"clear",
		];

		// Initialize Qified
		if (options.qified) {
			this._qified = options.qified;
		} else if (options.messageProviders) {
			this._qified = new Qified({ messageProviders: options.messageProviders });
		} else {
			throw new Error(
				"Either qified instance or messageProviders must be provided",
			);
		}

		// Subscribe if enabled
		if (this._enableSubscribe) {
			this.subscribe().catch((error) => {
				this.emit(CacheSyncEvents.ERROR, error);
			});
		}
	}

	/**
	 * Gets the Cacheable instance being synced
	 */
	public get cacheable(): CacheableInterface {
		return this._cacheable;
	}

	/**
	 * Gets the Qified instance being used
	 */
	public get qified(): Qified {
		return this._qified;
	}

	/**
	 * Gets the sync topic
	 */
	public get topic(): string {
		return this._topic;
	}

	/**
	 * Gets the instance ID
	 */
	public get instanceId(): string {
		return this._instanceId;
	}

	/**
	 * Gets whether publishing is enabled
	 */
	public get enablePublish(): boolean {
		return this._enablePublish;
	}

	/**
	 * Sets whether publishing is enabled
	 */
	public set enablePublish(value: boolean) {
		this._enablePublish = value;
	}

	/**
	 * Gets whether subscribing is enabled
	 */
	public get enableSubscribe(): boolean {
		return this._enableSubscribe;
	}

	/**
	 * Sets whether subscribing is enabled
	 */
	public set enableSubscribe(value: boolean) {
		this._enableSubscribe = value;
	}

	/**
	 * Gets the sync operations
	 */
	public get syncOperations(): SyncOperation[] {
		return this._syncOperations;
	}

	/**
	 * Sets the sync operations
	 */
	public set syncOperations(value: SyncOperation[]) {
		this._syncOperations = value;
	}

	/**
	 * Subscribe to sync messages from other cache instances
	 */
	public async subscribe(): Promise<void> {
		if (this._isSubscribed) {
			return;
		}

		await this._qified.subscribe(this._topic, {
			id: `cache-sync-${this._instanceId}`,
			handler: async (message: Message<SyncMessage>) => {
				await this.handleSyncMessage(message);
			},
		});

		this._isSubscribed = true;
	}

	/**
	 * Unsubscribe from sync messages
	 */
	public async unsubscribe(): Promise<void> {
		if (!this._isSubscribed) {
			return;
		}

		await this._qified.unsubscribe(
			this._topic,
			`cache-sync-${this._instanceId}`,
		);
		this._isSubscribed = false;
	}

	/**
	 * Syncs a set operation
	 */
	public async syncSet<T>(
		key: string,
		value: T,
		ttl?: number | string,
	): Promise<void> {
		if (!this._enablePublish || !this._syncOperations.includes("set")) {
			return;
		}

		const syncMessage: SyncMessage = {
			operation: "set",
			timestamp: Date.now(),
			instanceId: this._instanceId,
			data: { key, value, ttl },
		};

		await this.publishSyncMessage(syncMessage);
	}

	/**
	 * Syncs a setMany operation
	 */
	public async syncSetMany(items: CacheableItem[]): Promise<void> {
		if (!this._enablePublish || !this._syncOperations.includes("setMany")) {
			return;
		}

		const syncMessage: SyncMessage = {
			operation: "setMany",
			timestamp: Date.now(),
			instanceId: this._instanceId,
			data: { items },
		};

		await this.publishSyncMessage(syncMessage);
	}

	/**
	 * Syncs a delete operation
	 */
	public async syncDelete(key: string): Promise<void> {
		if (!this._enablePublish || !this._syncOperations.includes("delete")) {
			return;
		}

		const syncMessage: SyncMessage = {
			operation: "delete",
			timestamp: Date.now(),
			instanceId: this._instanceId,
			data: { key },
		};

		await this.publishSyncMessage(syncMessage);
	}

	/**
	 * Syncs a deleteMany operation
	 */
	public async syncDeleteMany(keys: string[]): Promise<void> {
		if (!this._enablePublish || !this._syncOperations.includes("deleteMany")) {
			return;
		}

		const syncMessage: SyncMessage = {
			operation: "deleteMany",
			timestamp: Date.now(),
			instanceId: this._instanceId,
			data: { keys },
		};

		await this.publishSyncMessage(syncMessage);
	}

	/**
	 * Syncs a clear operation
	 */
	public async syncClear(): Promise<void> {
		if (!this._enablePublish || !this._syncOperations.includes("clear")) {
			return;
		}

		const syncMessage: SyncMessage = {
			operation: "clear",
			timestamp: Date.now(),
			instanceId: this._instanceId,
		};

		await this.publishSyncMessage(syncMessage);
	}

	/**
	 * Disconnects the sync instance
	 */
	public async disconnect(): Promise<void> {
		await this.unsubscribe();
		await this._qified.disconnect();
	}

	/**
	 * Publishes a sync message
	 */
	private async publishSyncMessage(syncMessage: SyncMessage): Promise<void> {
		try {
			await this.hook(CacheSyncHooks.BEFORE_PUBLISH, syncMessage);

			await this._qified.publish(this._topic, {
				id: `${syncMessage.operation}-${syncMessage.timestamp}-${this._instanceId}`,
				data: syncMessage,
			});

			this.emit(CacheSyncEvents.SYNC_PUBLISHED, syncMessage);

			await this.hook(CacheSyncHooks.AFTER_PUBLISH, syncMessage);
		} catch (error: unknown) {
			this.emit(CacheSyncEvents.ERROR, error);
		}
	}

	/**
	 * Handles incoming sync messages
	 */
	private async handleSyncMessage(
		message: Message<SyncMessage>,
	): Promise<void> {
		const syncMessage = message.data;

		// Ignore messages from this instance
		if (syncMessage.instanceId === this._instanceId) {
			return;
		}

		// Ignore operations not in syncOperations
		if (!this._syncOperations.includes(syncMessage.operation)) {
			return;
		}

		try {
			this.emit(CacheSyncEvents.SYNC_RECEIVED, syncMessage);

			await this.hook(CacheSyncHooks.BEFORE_APPLY, syncMessage);

			// Apply the operation to the local cache
			switch (syncMessage.operation) {
				case "set": {
					if (syncMessage.data?.key && syncMessage.data.value !== undefined) {
						await this._cacheable.set(
							syncMessage.data.key,
							syncMessage.data.value,
							syncMessage.data.ttl,
						);
					}
					break;
				}
				case "setMany": {
					if (syncMessage.data?.items) {
						await this._cacheable.setMany(syncMessage.data.items);
					}
					break;
				}
				case "delete": {
					if (syncMessage.data?.key) {
						await this._cacheable.delete(syncMessage.data.key);
					}
					break;
				}
				case "deleteMany": {
					if (syncMessage.data?.keys) {
						await this._cacheable.deleteMany(syncMessage.data.keys);
					}
					break;
				}
				case "clear": {
					await this._cacheable.clear();
					break;
				}
			}

			this.emit(CacheSyncEvents.SYNC_APPLIED, syncMessage);

			await this.hook(CacheSyncHooks.AFTER_APPLY, syncMessage);
		} catch (error: unknown) {
			this.emit(CacheSyncEvents.ERROR, error);
		}
	}
}
