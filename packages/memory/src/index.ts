import {
	type CacheableItem,
	type CacheableStoreItem,
	type CacheSyncInstance,
	type GetOrSetFunctionOptions,
	type GetOrSetSyncKey,
	type GetOrSetSyncOptions,
	getOrSetSync,
	HashAlgorithm,
	hashToNumberSync,
	Stats,
	shorthandToTime,
	type WrapFunctionOptions,
	wrapSync,
} from "@cacheable/utils";
import { type Hook, Hookified } from "hookified";
import { DoublyLinkedList } from "./memory-lru.js";

export enum CacheableMemoryHooks {
	BEFORE_SET = "BEFORE_SET",
	AFTER_SET = "AFTER_SET",
	BEFORE_SET_MANY = "BEFORE_SET_MANY",
	AFTER_SET_MANY = "AFTER_SET_MANY",
	BEFORE_GET = "BEFORE_GET",
	AFTER_GET = "AFTER_GET",
	BEFORE_GET_MANY = "BEFORE_GET_MANY",
	AFTER_GET_MANY = "AFTER_GET_MANY",
	BEFORE_DELETE = "BEFORE_DELETE",
	AFTER_DELETE = "AFTER_DELETE",
	BEFORE_DELETE_MANY = "BEFORE_DELETE_MANY",
	AFTER_DELETE_MANY = "AFTER_DELETE_MANY",
	BEFORE_CLEAR = "BEFORE_CLEAR",
	AFTER_CLEAR = "AFTER_CLEAR",
}

export type StoreHashAlgorithmFunction = (
	key: string,
	storeHashSize: number,
) => number;

/**
 * @typedef {Object} CacheableMemoryOptions
 * @property {number|string} [ttl] - Time to Live - If you set a number it is miliseconds, if you set a string it is a human-readable
 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live. If both are
 * undefined then it will not have a time-to-live.
 * @property {number|string} [maxTtl] - Maximum Time to Live - The upper bound for any TTL set on a cache entry. If a TTL (whether from the
 * default or per-entry) exceeds this value, the entry's TTL is capped to maxTtl. Can be a number in milliseconds or a human-readable
 * format such as `1s`, `1m`, `1h`, `1d`. Default is `undefined` (no maximum).
 * @property {boolean} [useClone] - If true, it will clone the value before returning it. If false, it will return the value directly. Default is true.
 * @property {number} [lruSize] - The size of the LRU cache. If set to 0, it will not use LRU cache. Default is 0. If you are using LRU then the limit is based on Map() size 17mm.
 * @property {number} [checkInterval] - The interval to check for expired items. If set to 0, it will not check for expired items. Default is 0.
 * @property {number} [storeHashSize] - The number of how many Map stores we have for the hash. Default is 10.
 * @property {boolean} [stats] - If true, it will track statistics such as hits, misses, gets, sets, and deletes for this
 * instance. Statistics are accessible via the `stats` property. Default is `false`.
 */
export type CacheableMemoryOptions = {
	ttl?: number | string;
	maxTtl?: number | string;
	useClone?: boolean;
	lruSize?: number;
	checkInterval?: number;
	storeHashSize?: number;
	storeHashAlgorithm?:
		| HashAlgorithm
		| ((key: string, storeHashSize: number) => number);
	stats?: boolean;
};

export type SetOptions = {
	ttl?: number | string;
	expire?: number | Date;
};

/**
 * The payload passed to the `BEFORE_SET` and `AFTER_SET` hooks. Inside a `BEFORE_SET` handler
 * you can reassign `key`, `value`, or `ttl` to change what gets stored.
 */
export type CacheableMemoryHookItem<T = unknown> = {
	key: string;
	value: T;
	ttl?: number | string | SetOptions;
};

/** The payload passed to the `AFTER_GET` hook. `result` is `undefined` on a cache miss. */
export type CacheableMemoryAfterGetItem<T = unknown> = {
	key: string;
	result: T | undefined;
};

/** The payload passed to the `AFTER_GET_MANY` hook. */
export type CacheableMemoryAfterGetManyItem<T = unknown> = {
	keys: string[];
	result: T[];
};

/**
 * Maps each {@link CacheableMemoryHooks} name to the payload its handler receives, so `onHook`
 * can be strongly typed. Handlers run synchronously (via `hookSync`), so an async handler would
 * not be awaited.
 */
export type CacheableMemoryHookHandlerMap = {
	[CacheableMemoryHooks.BEFORE_SET]: (item: CacheableMemoryHookItem) => void;
	[CacheableMemoryHooks.AFTER_SET]: (item: CacheableMemoryHookItem) => void;
	[CacheableMemoryHooks.BEFORE_SET_MANY]: (items: CacheableItem[]) => void;
	[CacheableMemoryHooks.AFTER_SET_MANY]: (items: CacheableItem[]) => void;
	[CacheableMemoryHooks.BEFORE_GET]: (key: string) => void;
	[CacheableMemoryHooks.AFTER_GET]: (item: CacheableMemoryAfterGetItem) => void;
	[CacheableMemoryHooks.BEFORE_GET_MANY]: (keys: string[]) => void;
	[CacheableMemoryHooks.AFTER_GET_MANY]: (
		item: CacheableMemoryAfterGetManyItem,
	) => void;
	[CacheableMemoryHooks.BEFORE_DELETE]: (key: string) => void;
	[CacheableMemoryHooks.AFTER_DELETE]: (key: string) => void;
	[CacheableMemoryHooks.BEFORE_DELETE_MANY]: (keys: string[]) => void;
	[CacheableMemoryHooks.AFTER_DELETE_MANY]: (keys: string[]) => void;
	[CacheableMemoryHooks.BEFORE_CLEAR]: () => void;
	[CacheableMemoryHooks.AFTER_CLEAR]: () => void;
};

export const defaultStoreHashSize = 16; // Default is 16
export const maximumMapSize = 16_777_216; // Maximum size of a Map is 16,777,216 (2^24) due to the way JavaScript handles memory allocation

export class CacheableMemory extends Hookified {
	private _lru = new DoublyLinkedList<string>();
	private _storeHashSize = defaultStoreHashSize;
	private _storeHashAlgorithm:
		| HashAlgorithm
		| ((key: string, storeHashSize: number) => number) = HashAlgorithm.DJB2; // Default is djb2Hash
	private _store = Array.from(
		{ length: this._storeHashSize },
		() => new Map<string, CacheableStoreItem>(),
	);
	private _ttl: number | string | undefined; // Turned off by default
	private _maxTtl: number | string | undefined; // Turned off by default
	private _useClone = true; // Turned on by default
	private _lruSize = 0; // Turned off by default
	private _checkInterval = 0; // Turned off by default
	private _interval: number | NodeJS.Timeout = 0; // Turned off by default
	private readonly _stats = new Stats({ enabled: false }); // Turned off by default

	/**
	 * @constructor
	 * @param {CacheableMemoryOptions} [options] - The options for the CacheableMemory
	 */
	constructor(options?: CacheableMemoryOptions) {
		super();

		if (options?.ttl) {
			this.setTtl(options.ttl);
		}

		if (options?.maxTtl !== undefined) {
			this.setMaxTtl(options.maxTtl);
		}

		if (options?.useClone !== undefined) {
			this._useClone = options.useClone;
		}

		if (options?.stats) {
			this._stats.enabled = options.stats;
		}

		if (options?.storeHashSize && options.storeHashSize > 0) {
			this._storeHashSize = options.storeHashSize;
		}

		if (options?.lruSize) {
			if (options.lruSize > maximumMapSize) {
				this.emit(
					"error",
					new Error(
						`LRU size cannot be larger than ${maximumMapSize} due to Map limitations.`,
					),
				);
			} else {
				this._lruSize = options.lruSize;
			}
		}

		if (options?.checkInterval) {
			this._checkInterval = options.checkInterval;
		}

		if (options?.storeHashAlgorithm) {
			this._storeHashAlgorithm = options.storeHashAlgorithm;
		}

		this._store = Array.from(
			{ length: this._storeHashSize },
			() => new Map<string, CacheableStoreItem>(),
		);

		this.startIntervalCheck();
	}

	/**
	 * Registers a handler for a hook. Built-in {@link CacheableMemoryHooks} names get a
	 * strongly-typed payload (e.g. `BEFORE_SET` receives a {@link CacheableMemoryHookItem} whose
	 * `key`, `value`, and `ttl` you can reassign); any other event name falls back to the loose
	 * Hookified signature.
	 * @param hook The hook to register the handler for
	 * @param handler The handler to call when the hook is triggered
	 */
	public onHook<K extends CacheableMemoryHooks>(
		hook: K,
		handler: CacheableMemoryHookHandlerMap[K],
	): void;
	public onHook(event: string, handler: Hook): void;
	public onHook(event: string, handler: Hook): void {
		super.onHook(event, handler);
	}

	/**
	 * Gets the time-to-live
	 * @returns {number|string|undefined} - The time-to-live in miliseconds or a human-readable format. If undefined, it will not have a time-to-live.
	 */
	public get ttl(): number | string | undefined {
		return this._ttl;
	}

	/**
	 * Sets the time-to-live
	 * @param {number|string|undefined} value - The time-to-live in miliseconds or a human-readable format (example '1s' = 1 second, '1h' = 1 hour). If undefined, it will not have a time-to-live.
	 */
	public set ttl(value: number | string | undefined) {
		this.setTtl(value);
	}

	/**
	 * Gets the maximum time-to-live. When set, any TTL that exceeds this value is capped to maxTtl.
	 * Entries with no TTL will also be capped to maxTtl. Default is `undefined` (no maximum).
	 * @returns {number|string|undefined} - The maximum TTL in milliseconds, human-readable format, or undefined.
	 */
	public get maxTtl(): number | string | undefined {
		return this._maxTtl;
	}

	/**
	 * Sets the maximum time-to-live. When set, any TTL that exceeds this value is capped to maxTtl.
	 * Entries with no TTL will also be capped to maxTtl.
	 * @param {number|string|undefined} value - The maximum TTL in milliseconds or human-readable format (e.g. '1s', '1h'). If undefined, no maximum is enforced.
	 */
	public set maxTtl(value: number | string | undefined) {
		this.setMaxTtl(value);
	}

	/**
	 * Gets whether to use clone
	 * @returns {boolean} - If true, it will clone the value before returning it. If false, it will return the value directly. Default is true.
	 */
	public get useClone(): boolean {
		return this._useClone;
	}

	/**
	 * Sets whether to use clone
	 * @param {boolean} value - If true, it will clone the value before returning it. If false, it will return the value directly. Default is true.
	 */
	public set useClone(value: boolean) {
		this._useClone = value;
	}

	/**
	 * Gets the size of the LRU cache
	 * @returns {number} - The size of the LRU cache. If set to 0, it will not use LRU cache. Default is 0. If you are using LRU then the limit is based on Map() size 17mm.
	 */
	public get lruSize(): number {
		return this._lruSize;
	}

	/**
	 * Sets the size of the LRU cache
	 * @param {number} value - The size of the LRU cache. If set to 0, it will not use LRU cache. Default is 0. If you are using LRU then the limit is based on Map() size 17mm.
	 */
	public set lruSize(value: number) {
		if (value > maximumMapSize) {
			this.emit(
				"error",
				new Error(
					`LRU size cannot be larger than ${maximumMapSize} due to Map limitations.`,
				),
			);
			return;
		}

		this._lruSize = value;

		if (this._lruSize === 0) {
			this._lru = new DoublyLinkedList<string>(); // Reset the LRU cache
			return;
		}

		this.lruResize();
	}

	/**
	 * Gets the check interval
	 * @returns {number} - The interval to check for expired items. If set to 0, it will not check for expired items. Default is 0.
	 */
	public get checkInterval(): number {
		return this._checkInterval;
	}

	/**
	 * Sets the check interval
	 * @param {number} value - The interval to check for expired items. If set to 0, it will not check for expired items. Default is 0.
	 */
	public set checkInterval(value: number) {
		this._checkInterval = value;
	}

	/**
	 * Gets the size of the cache
	 * @returns {number} - The size of the cache
	 */
	public get size(): number {
		let size = 0;
		for (const store of this._store) {
			size += store.size;
		}

		return size;
	}

	/**
	 * Gets the statistics of the cache. Statistics track aggregate counters such as `hits`, `misses`,
	 * `gets`, `sets`, `deletes`, `clears`, `count`, `ksize`, and `vsize`. They are disabled by default;
	 * enable them via the `stats` option or by setting `cache.stats.enabled = true`.
	 * @returns {Stats} - The statistics for this CacheableMemory instance
	 */
	public get stats(): Stats {
		return this._stats;
	}

	/**
	 * Gets the number of hash stores
	 * @returns {number} - The number of hash stores
	 */
	public get storeHashSize(): number {
		return this._storeHashSize;
	}

	/**
	 * Sets the number of hash stores. This will recreate the store and all data will be cleared
	 * @param {number} value - The number of hash stores
	 */
	public set storeHashSize(value: number) {
		if (value === this._storeHashSize) {
			return; // No need to recreate the store if the size is the same
		}

		this._storeHashSize = value;

		this._store = Array.from(
			{ length: this._storeHashSize },
			() => new Map<string, CacheableStoreItem>(),
		);

		// Recreating the store clears all data, so the size stats no longer describe the cache.
		if (this._stats.enabled) {
			this._stats.resetStoreValues();
		}
	}

	/**
	 * Gets the store hash algorithm
	 * @returns {HashAlgorithm | StoreHashAlgorithmFunction} - The store hash algorithm
	 */
	public get storeHashAlgorithm(): HashAlgorithm | StoreHashAlgorithmFunction {
		return this._storeHashAlgorithm;
	}

	/**
	 * Sets the store hash algorithm. This will recreate the store and all data will be cleared
	 * @param {HashAlgorithm | HashAlgorithmFunction} value - The store hash algorithm
	 */
	public set storeHashAlgorithm(value:
		| HashAlgorithm
		| StoreHashAlgorithmFunction) {
		this._storeHashAlgorithm = value;
	}

	/**
	 * Gets the keys
	 * @returns {IterableIterator<string>} - The keys
	 */
	public get keys(): IterableIterator<string> {
		const keys: string[] = [];
		for (const store of this._store) {
			for (const key of store.keys()) {
				const item = store.get(key);
				if (item && this.hasExpired(item)) {
					this.recordExpiration(item);
					store.delete(key);
					this.lruRemove(key);
					continue;
				}

				keys.push(key);
			}
		}

		return keys.values();
	}

	/**
	 * Gets the items
	 * @returns {IterableIterator<CacheableStoreItem>} - The items
	 */
	public get items(): IterableIterator<CacheableStoreItem> {
		const items: CacheableStoreItem[] = [];
		for (const store of this._store) {
			for (const item of store.values()) {
				if (this.hasExpired(item)) {
					this.recordExpiration(item);
					store.delete(item.key);
					this.lruRemove(item.key);
					continue;
				}

				items.push(item);
			}
		}

		return items.values();
	}

	/**
	 * Gets the store
	 * @returns {Array<Map<string, CacheableStoreItem>>} - The store
	 */
	public get store(): Array<Map<string, CacheableStoreItem>> {
		return this._store;
	}

	/**
	 * Gets the value of the key
	 * @param {string} key - The key to get the value
	 * @returns {T | undefined} - The value of the key
	 */
	public get<T>(key: string): T | undefined {
		this.hookSync(CacheableMemoryHooks.BEFORE_GET, key);
		const store = this.getStore(key);
		const item = store.get(key);
		if (!item) {
			this.recordRead(false);
			this.hookSync(CacheableMemoryHooks.AFTER_GET, { key, result: undefined });
			return undefined;
		}

		if (item.expires && Date.now() > item.expires) {
			this.recordExpiration(item);
			store.delete(key);
			this.lruRemove(key);
			this.recordRead(false);
			this.hookSync(CacheableMemoryHooks.AFTER_GET, { key, result: undefined });
			return undefined;
		}

		this.lruMoveToFront(key);

		let result: T;
		if (!this._useClone) {
			result = item.value as T;
		} else {
			result = this.clone(item.value) as T;
		}

		this.recordRead(true);
		this.hookSync(CacheableMemoryHooks.AFTER_GET, { key, result });
		return result;
	}

	/**
	 * Gets the values of the keys
	 * @param {string[]} keys - The keys to get the values
	 * @returns {T[]} - The values of the keys
	 */
	public getMany<T>(keys: string[]): T[] {
		this.hookSync(CacheableMemoryHooks.BEFORE_GET_MANY, keys);
		const result: T[] = [];
		for (const key of keys) {
			result.push(this.get(key) as T);
		}

		this.hookSync(CacheableMemoryHooks.AFTER_GET_MANY, { keys, result });
		return result;
	}

	/**
	 * Gets the raw value of the key
	 * @param {string} key - The key to get the value
	 * @returns {CacheableStoreItem | undefined} - The raw value of the key
	 */
	public getRaw(key: string): CacheableStoreItem | undefined {
		const store = this.getStore(key);
		const item = store.get(key);
		if (!item) {
			this.recordRead(false);
			return undefined;
		}

		if (item.expires && Date.now() > item.expires) {
			this.recordExpiration(item);
			store.delete(key);
			this.lruRemove(key);
			this.recordRead(false);
			return undefined;
		}

		this.lruMoveToFront(key);
		this.recordRead(true);
		return item;
	}

	/**
	 * Gets the raw values of the keys
	 * @param {string[]} keys - The keys to get the values
	 * @returns {CacheableStoreItem[]} - The raw values of the keys
	 */
	public getManyRaw(keys: string[]): Array<CacheableStoreItem | undefined> {
		const result: (CacheableStoreItem | undefined)[] = [];
		for (const key of keys) {
			result.push(this.getRaw(key));
		}

		return result;
	}

	/**
	 * Sets the value of the key
	 * @param {string} key - The key to set the value
	 * @param {any} value - The value to set
	 * @param {number|string|SetOptions} [ttl] - Time to Live - If you set a number it is miliseconds, if you set a string it is a human-readable.
	 * If you want to set expire directly you can do that by setting the expire property in the SetOptions.
	 * If you set undefined, it will use the default time-to-live. If both are undefined then it will not have a time-to-live.
	 * @returns {void}
	 */
	public set(
		key: string,
		// biome-ignore lint/suspicious/noExplicitAny: type format
		value: any,
		ttl?: number | string | SetOptions,
	): void {
		const hookItem = { key, value, ttl };
		this.hookSync(CacheableMemoryHooks.BEFORE_SET, hookItem);

		const store = this.getStore(hookItem.key);
		// biome-ignore lint/suspicious/noImplicitAnyLet: allowed
		let expires;
		const effectiveTtl = hookItem.ttl;
		if (effectiveTtl !== undefined || this._ttl !== undefined) {
			if (typeof effectiveTtl === "object") {
				if (effectiveTtl.expire) {
					expires =
						typeof effectiveTtl.expire === "number"
							? effectiveTtl.expire
							: effectiveTtl.expire.getTime();
				}

				if (effectiveTtl.ttl) {
					const finalTtl = shorthandToTime(effectiveTtl.ttl);
					/* v8 ignore next -- @preserve */
					if (finalTtl !== undefined) {
						expires = finalTtl;
					}
				}
			} else {
				const finalTtl = shorthandToTime(effectiveTtl ?? this._ttl);

				/* v8 ignore next -- @preserve */
				if (finalTtl !== undefined) {
					expires = finalTtl;
				}
			}
		}

		if (this._maxTtl !== undefined) {
			const maxExpires = shorthandToTime(this._maxTtl);
			if (expires === undefined) {
				expires = maxExpires;
			} else if (expires > maxExpires) {
				expires = maxExpires;
			}
		}

		if (this._lruSize > 0) {
			if (store.has(hookItem.key)) {
				this.lruMoveToFront(hookItem.key);
			} else {
				this.lruAddToFront(hookItem.key);
				if (this._lru.size > this._lruSize) {
					const oldestKey = this._lru.getOldest();
					/* v8 ignore next -- @preserve */
					if (oldestKey) {
						this._lru.removeOldest();
						this.delete(oldestKey);
					}
				}
			}
		}

		if (this._stats.enabled) {
			const existing = store.get(hookItem.key);
			if (existing) {
				// Overwrite: the key is already counted, so only swap the value size
				this._stats.decreaseVSize(existing.value);
			} else {
				this._stats.incrementKSize(hookItem.key);
				this._stats.incrementCount();
			}

			this._stats.incrementVSize(hookItem.value);
			this._stats.incrementSets();
		}

		const item = { key: hookItem.key, value: hookItem.value, expires };
		store.set(hookItem.key, item);

		this.hookSync(CacheableMemoryHooks.AFTER_SET, hookItem);
	}

	/**
	 * Sets the values of the keys
	 * @param {CacheableItem[]} items - The items to set
	 * @returns {void}
	 */
	public setMany(items: CacheableItem[]): void {
		this.hookSync(CacheableMemoryHooks.BEFORE_SET_MANY, items);
		for (const item of items) {
			this.set(item.key, item.value, item.ttl);
		}

		this.hookSync(CacheableMemoryHooks.AFTER_SET_MANY, items);
	}

	/**
	 * Checks if the key exists
	 * @param {string} key - The key to check
	 * @returns {boolean} - If true, the key exists. If false, the key does not exist.
	 */
	public has(key: string): boolean {
		const item = this.get(key);
		return Boolean(item);
	}

	/**
	 * @function hasMany
	 * @param {string[]} keys - The keys to check
	 * @returns {boolean[]} - If true, the key exists. If false, the key does not exist.
	 */
	public hasMany(keys: string[]): boolean[] {
		const result: boolean[] = [];
		for (const key of keys) {
			const item = this.get(key);
			result.push(Boolean(item));
		}

		return result;
	}

	/**
	 * Take will get the key and delete the entry from cache
	 * @param {string} key - The key to take
	 * @returns {T | undefined} - The value of the key
	 */
	public take<T>(key: string): T | undefined {
		const item = this.get(key);
		if (!item) {
			return undefined;
		}

		this.delete(key);
		return item as T;
	}

	/**
	 * TakeMany will get the keys and delete the entries from cache
	 * @param {string[]} keys - The keys to take
	 * @returns {T[]} - The values of the keys
	 */
	public takeMany<T>(keys: string[]): T[] {
		// biome-ignore lint/suspicious/noExplicitAny: type format
		const result: any[] = [];
		for (const key of keys) {
			result.push(this.take(key) as T);
		}

		return result as T[];
	}

	/**
	 * Delete the key
	 * @param {string} key - The key to delete
	 * @returns {void}
	 */
	public delete(key: string): void {
		this.hookSync(CacheableMemoryHooks.BEFORE_DELETE, key);
		const store = this.getStore(key);
		if (this._stats.enabled) {
			const item = store.get(key);
			if (item) {
				this._stats.decreaseKSize(key);
				this._stats.decreaseVSize(item.value);
				this._stats.decreaseCount();
				this._stats.incrementDeletes();
			}
		}

		store.delete(key);
		this.lruRemove(key);
		this.hookSync(CacheableMemoryHooks.AFTER_DELETE, key);
	}

	/**
	 * Delete the keys
	 * @param {string[]} keys - The keys to delete
	 * @returns {void}
	 */
	public deleteMany(keys: string[]): void {
		this.hookSync(CacheableMemoryHooks.BEFORE_DELETE_MANY, keys);
		for (const key of keys) {
			this.delete(key);
		}

		this.hookSync(CacheableMemoryHooks.AFTER_DELETE_MANY, keys);
	}

	/**
	 * Clear the cache
	 * @returns {void}
	 */
	public clear(): void {
		this.hookSync(CacheableMemoryHooks.BEFORE_CLEAR);
		this._store = Array.from(
			{ length: this._storeHashSize },
			() => new Map<string, CacheableStoreItem>(),
		);
		this._lru = new DoublyLinkedList<string>();
		if (this._stats.enabled) {
			this._stats.resetStoreValues();
			this._stats.incrementClears();
		}

		this.hookSync(CacheableMemoryHooks.AFTER_CLEAR);
	}

	/**
	 * Get the store based on the key (internal use)
	 * @param {string} key - The key to get the store
	 * @returns {CacheableHashStore} - The store
	 */
	public getStore(key: string): Map<string, CacheableStoreItem> {
		const hash = this.getKeyStoreHash(key);
		this._store[hash] ||= new Map<string, CacheableStoreItem>();

		return this._store[hash];
	}

	/**
	 * Hash the key for which store to go to (internal use)
	 * @param {string} key - The key to hash
	 * Available algorithms are: SHA256, SHA1, MD5, and djb2Hash.
	 * @returns {number} - The hashed key as a number
	 */
	public getKeyStoreHash(key: string): number {
		if (this._store.length === 1) {
			return 0; // If we only have one store, we always return 0
		}

		// If we have a function, we call it with the store hash size
		if (typeof this._storeHashAlgorithm === "function") {
			return this._storeHashAlgorithm(key, this._storeHashSize);
		}

		const storeHashSize = this._storeHashSize - 1;

		const hash = hashToNumberSync(key, {
			min: 0,
			max: storeHashSize,
			algorithm: this._storeHashAlgorithm,
		});
		return hash;
	}

	/**
	 * Clone the value. This is for internal use
	 * @param {any} value - The value to clone
	 * @returns {any} - The cloned value
	 */
	// biome-ignore lint/suspicious/noExplicitAny: type format
	public clone(value: any): any {
		if (this.isPrimitive(value)) {
			return value;
		}

		return structuredClone(value);
	}

	/**
	 * Add to the front of the LRU cache. This is for internal use
	 * @param {string} key - The key to add to the front
	 * @returns {void}
	 */
	public lruAddToFront(key: string): void {
		if (this._lruSize === 0) {
			return;
		}

		this._lru.addToFront(key);
	}

	/**
	 * Move to the front of the LRU cache. This is for internal use
	 * @param {string} key - The key to move to the front
	 * @returns {void}
	 */
	public lruMoveToFront(key: string): void {
		if (this._lruSize === 0) {
			return;
		}

		this._lru.moveToFront(key);
	}

	/**
	 * Remove a key from the LRU cache. This is for internal use
	 * @param {string} key - The key to remove
	 * @returns {void}
	 */
	public lruRemove(key: string): void {
		if (this._lruSize === 0) {
			return;
		}

		this._lru.remove(key);
	}

	/**
	 * Resize the LRU cache. This is for internal use.
	 * @returns {void}
	 */
	public lruResize(): void {
		while (this._lru.size > this._lruSize) {
			const oldestKey = this._lru.getOldest();
			/* v8 ignore next -- @preserve */
			if (oldestKey) {
				this._lru.removeOldest();
				this.delete(oldestKey);
			}
		}
	}

	/**
	 * Check for expiration. This is for internal use
	 * @returns {void}
	 */
	public checkExpiration() {
		for (const store of this._store) {
			for (const item of store.values()) {
				if (item.expires && Date.now() > item.expires) {
					this.recordExpiration(item);
					store.delete(item.key);
					this.lruRemove(item.key);
				}
			}
		}
	}

	/**
	 * Start the interval check. This is for internal use
	 * @returns {void}
	 */
	public startIntervalCheck() {
		if (this._checkInterval > 0) {
			/* v8 ignore next -- @preserve */
			if (this._interval) {
				// Be overly cautious and clear the interval as we've unref'd it and we don't want to leak it
				/* v8 ignore next -- @preserve */
				clearInterval(this._interval);
			}

			this._interval = setInterval(() => {
				this.checkExpiration();
			}, this._checkInterval).unref();
		}
	}

	/**
	 * Stop the interval check. This is for internal use
	 * @returns {void}
	 */
	public stopIntervalCheck() {
		/* v8 ignore next -- @preserve */
		if (this._interval) {
			clearInterval(this._interval);
		}

		this._interval = 0;
		this._checkInterval = 0;
	}

	/**
	 * Wrap the function for caching
	 * @param {Function} function_ - The function to wrap
	 * @param {Object} [options] - The options to wrap
	 * @returns {Function} - The wrapped function
	 */
	// biome-ignore lint/suspicious/noExplicitAny: type format
	public wrap<T, Arguments extends any[]>(
		function_: (...arguments_: Arguments) => T,
		options?: WrapFunctionOptions,
	): (...arguments_: Arguments) => T {
		const wrapOptions = {
			ttl: options?.ttl ?? this._ttl,
			keyPrefix: options?.keyPrefix,
			createKey: options?.createKey,
			cache: this as CacheSyncInstance,
		};

		return wrapSync<T>(function_, wrapOptions);
	}

	/**
	 * Gets the value of the key, or computes and stores it on a cache miss. This is the synchronous
	 * cache-aside helper: if the key is present its value is returned, otherwise `function_` is
	 * invoked, its result is stored, and that result is returned.
	 *
	 * The value is stored using `options.ttl`, falling back to the instance default `ttl`. Because
	 * the cache is synchronous there is no request coalescing — concurrent callers cannot stampede
	 * the setter the way they can with an async cache.
	 * @param {GetOrSetSyncKey} key - The key to get or set. Can also be a function that returns the key.
	 * @param {() => T} function_ - The function that computes the value on a cache miss.
	 * @param {GetOrSetFunctionOptions} [options] - Options such as `ttl`, `cacheErrors`, and `throwErrors`.
	 * @returns {T | undefined} - The cached or freshly computed value
	 */
	public getOrSet<T>(
		key: GetOrSetSyncKey,
		function_: () => T,
		options?: GetOrSetFunctionOptions,
	): T | undefined {
		const getOrSetOptions: GetOrSetSyncOptions = {
			cache: this as CacheSyncInstance,
			ttl: options?.ttl ?? this._ttl,
			cacheErrors: options?.cacheErrors,
			throwErrors: options?.throwErrors,
		};

		return getOrSetSync<T>(key, function_, getOrSetOptions);
	}

	/**
	 * Records a single read against the statistics counters. Each read increments `gets` and either
	 * `hits` or `misses`. No-op when statistics are disabled. This is for internal use.
	 * @param {boolean} hit - Whether the read found a (non-expired) value
	 * @returns {void}
	 */
	private recordRead(hit: boolean): void {
		if (!this._stats.enabled) {
			return;
		}

		if (hit) {
			this._stats.incrementHits();
		} else {
			this._stats.incrementMisses();
		}

		this._stats.incrementGets();
	}

	/**
	 * Decrements the size statistics (`count`, `ksize`, and `vsize`) for an entry that is being removed
	 * because it expired. Expirations are not counted as `deletes` since they are not user-initiated.
	 * No-op when statistics are disabled. This is for internal use.
	 * @param {CacheableStoreItem} item - The expired item being removed from the store
	 * @returns {void}
	 */
	private recordExpiration(item: CacheableStoreItem): void {
		if (!this._stats.enabled) {
			return;
		}

		this._stats.decreaseKSize(item.key);
		this._stats.decreaseVSize(item.value);
		this._stats.decreaseCount();
	}

	// biome-ignore lint/suspicious/noExplicitAny: type format
	private isPrimitive(value: any): boolean {
		const result = false;

		/* v8 ignore next -- @preserve */
		if (value === null || value === undefined) {
			return true;
		}

		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			return true;
		}

		return result;
	}

	private setTtl(ttl: number | string | undefined): void {
		if (typeof ttl === "string" || ttl === undefined) {
			this._ttl = ttl;
		} else if (ttl > 0) {
			this._ttl = ttl;
		} else {
			this._ttl = undefined;
		}
	}

	private setMaxTtl(maxTtl: number | string | undefined): void {
		if (typeof maxTtl === "string" || maxTtl === undefined) {
			this._maxTtl = maxTtl;
		} else if (maxTtl > 0) {
			this._maxTtl = maxTtl;
		} else {
			this._maxTtl = undefined;
		}
	}

	private hasExpired(item: CacheableStoreItem): boolean {
		if (item.expires && Date.now() > item.expires) {
			return true;
		}

		return false;
	}
}

export {
	type CacheableItem,
	type CacheableStoreItem,
	type GetOrSetFunctionOptions,
	type GetOrSetSyncKey,
	type GetOrSetSyncOptions,
	getOrSetSync,
	HashAlgorithm,
	hash,
	hashToNumber,
	Stats,
	type StatsOptions,
	type StatsSnapshot,
} from "@cacheable/utils";
export {
	createKeyv,
	KeyvCacheableMemory,
	type KeyvCacheableMemoryOptions,
} from "./keyv-memory.js";
