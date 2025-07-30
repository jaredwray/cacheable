import {Hookified} from 'hookified';
import {wrapSync, type WrapFunctionOptions} from './wrap.js';
import {DoublyLinkedList} from './memory-lru.js';
import {shorthandToTime} from './shorthand-time.js';
import {type CacheableStoreItem, type CacheableItem} from './cacheable-item-types.js';
import {djb2Hash, hashToNumber} from './hash.js';

export enum StoreHashAlgorithm {
	SHA256 = 'sha256',
	SHA1 = 'sha1',
	MD5 = 'md5',
	djb2Hash = 'djb2Hash',
}

export type StoreHashAlgorithmFunction = ((key: string, storeHashSize: number) => number);

/**
 * @typedef {Object} CacheableMemoryOptions
 * @property {number|string} [ttl] - Time to Live - If you set a number it is miliseconds, if you set a string it is a human-readable
 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live. If both are
 * undefined then it will not have a time-to-live.
 * @property {boolean} [useClone] - If true, it will clone the value before returning it. If false, it will return the value directly. Default is true.
 * @property {number} [lruSize] - The size of the LRU cache. If set to 0, it will not use LRU cache. Default is 0. If you are using LRU then the limit is based on Map() size 17mm.
 * @property {number} [checkInterval] - The interval to check for expired items. If set to 0, it will not check for expired items. Default is 0.
 * @property {number} [storeHashSize] - The number of how many Map stores we have for the hash. Default is 10.
 */
export type CacheableMemoryOptions = {
	ttl?: number | string;
	useClone?: boolean;
	lruSize?: number;
	checkInterval?: number;
	storeHashSize?: number;
	storeHashAlgorithm?: StoreHashAlgorithm | ((key: string, storeHashSize: number) => number);
};

export type SetOptions = {
	ttl?: number | string;
	expire?: number | Date;
};

export const defaultStoreHashSize = 16; // Default is 16
export const maximumMapSize = 16_777_216; // Maximum size of a Map is 16,777,216 (2^24) due to the way JavaScript handles memory allocation

export class CacheableMemory extends Hookified {
	private _lru = new DoublyLinkedList<string>();
	private _storeHashSize = defaultStoreHashSize;
	private _storeHashAlgorithm: StoreHashAlgorithm | ((key: string, storeHashSize: number) => number) = StoreHashAlgorithm.djb2Hash; // Default is djb2Hash
	private _store = Array.from({length: this._storeHashSize}, () => new Map<string, CacheableStoreItem>());
	private _ttl: number | string | undefined; // Turned off by default
	private _useClone = true; // Turned on by default
	private _lruSize = 0; // Turned off by default
	private _checkInterval = 0; // Turned off by default
	private _interval: number | NodeJS.Timeout = 0; // Turned off by default

	/**
	 * @constructor
	 * @param {CacheableMemoryOptions} [options] - The options for the CacheableMemory
	 */
	constructor(options?: CacheableMemoryOptions) {
		super();

		if (options?.ttl) {
			this.setTtl(options.ttl);
		}

		if (options?.useClone !== undefined) {
			this._useClone = options.useClone;
		}

		if (options?.storeHashSize && options.storeHashSize > 0) {
			this._storeHashSize = options.storeHashSize;
		}

		if (options?.lruSize) {
			if (options.lruSize > maximumMapSize) {
				this.emit('error', new Error(`LRU size cannot be larger than ${maximumMapSize} due to Map limitations.`));
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

		this._store = Array.from({length: this._storeHashSize}, () => new Map<string, CacheableStoreItem>());

		this.startIntervalCheck();
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
			this.emit('error', new Error(`LRU size cannot be larger than ${maximumMapSize} due to Map limitations.`));
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

		this._store = Array.from({length: this._storeHashSize}, () => new Map<string, CacheableStoreItem>());
	}

	/**
	 * Gets the store hash algorithm
	 * @returns {StoreHashAlgorithm | StoreHashAlgorithmFunction} - The store hash algorithm
	 */
	public get storeHashAlgorithm(): StoreHashAlgorithm | StoreHashAlgorithmFunction {
		return this._storeHashAlgorithm;
	}

	/**
	 * Sets the store hash algorithm. This will recreate the store and all data will be cleared
	 * @param {StoreHashAlgorithm | StoreHashAlgorithmFunction} value - The store hash algorithm
	 */
	public set storeHashAlgorithm(value: StoreHashAlgorithm | StoreHashAlgorithmFunction) {
		this._storeHashAlgorithm = value;
	}

	/**
	 * Gets the keys
	 * @returns {IterableIterator<string>} - The keys
	 */
	public get keys(): IterableIterator<string> {
		const keys = new Array<string>();
		for (const store of this._store) {
			for (const key of store.keys()) {
				const item = store.get(key);
				if (item && this.hasExpired(item)) {
					store.delete(key);
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
		const items = new Array<CacheableStoreItem>();
		for (const store of this._store) {
			for (const item of store.values()) {
				if (this.hasExpired(item)) {
					store.delete(item.key);
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
		const store = this.getStore(key);
		const item = store.get(key)!;
		if (!item) {
			return undefined;
		}

		if (item.expires && Date.now() > item.expires) {
			store.delete(key);
			return undefined;
		}

		this.lruMoveToFront(key);

		if (!this._useClone) {
			return item.value as T;
		}

		return this.clone(item.value) as T;
	}

	/**
	 * Gets the values of the keys
	 * @param {string[]} keys - The keys to get the values
	 * @returns {T[]} - The values of the keys
	 */
	public getMany<T>(keys: string[]): T[] {
		const result = new Array<T>();
		for (const key of keys) {
			result.push(this.get(key) as T);
		}

		return result;
	}

	/**
	 * Gets the raw value of the key
	 * @param {string} key - The key to get the value
	 * @returns {CacheableStoreItem | undefined} - The raw value of the key
	 */
	public getRaw(key: string): CacheableStoreItem | undefined {
		const store = this.getStore(key);
		const item = store.get(key)!;
		if (!item) {
			return undefined;
		}

		if (item.expires && item.expires && Date.now() > item.expires) {
			store.delete(key);
			return undefined;
		}

		this.lruMoveToFront(key);
		return item;
	}

	/**
	 * Gets the raw values of the keys
	 * @param {string[]} keys - The keys to get the values
	 * @returns {CacheableStoreItem[]} - The raw values of the keys
	 */
	public getManyRaw(keys: string[]): Array<CacheableStoreItem | undefined> {
		const result = new Array<CacheableStoreItem | undefined>();
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
	public set(key: string, value: any, ttl?: number | string | SetOptions): void {
		const store = this.getStore(key);
		let expires;
		if (ttl !== undefined || this._ttl !== undefined) {
			if (typeof ttl === 'object') {
				if (ttl.expire) {
					expires = typeof ttl.expire === 'number' ? ttl.expire : ttl.expire.getTime();
				}

				if (ttl.ttl) {
					const finalTtl = shorthandToTime(ttl.ttl);
					if (finalTtl !== undefined) {
						expires = finalTtl;
					}
				}
			} else {
				const finalTtl = shorthandToTime(ttl ?? this._ttl);

				if (finalTtl !== undefined) {
					expires = finalTtl;
				}
			}
		}

		if (this._lruSize > 0) {
			if (store.has(key)) {
				this.lruMoveToFront(key);
			} else {
				this.lruAddToFront(key);
				if (this._lru.size > this._lruSize) {
					const oldestKey = this._lru.getOldest();
					if (oldestKey) {
						this._lru.removeOldest();
						this.delete(oldestKey);
					}
				}
			}
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const item = {key, value, expires};
		store.set(
			key,
			item,
		);
	}

	/**
	 * Sets the values of the keys
	 * @param {CacheableItem[]} items - The items to set
	 * @returns {void}
	 */
	public setMany(items: CacheableItem[]): void {
		for (const item of items) {
			this.set(item.key, item.value, item.ttl);
		}
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
		const result = new Array<boolean>();
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
		const result = new Array<any>();
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
		const store = this.getStore(key);
		store.delete(key);
	}

	/**
	 * Delete the keys
	 * @param {string[]} keys - The keys to delete
	 * @returns {void}
	 */
	public deleteMany(keys: string[]): void {
		for (const key of keys) {
			this.delete(key);
		}
	}

	/**
	 * Clear the cache
	 * @returns {void}
	 */
	public clear(): void {
		this._store = Array.from({length: this._storeHashSize}, () => new Map<string, CacheableStoreItem>());
		this._lru = new DoublyLinkedList<string>();
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

		// Most used and should default to this
		if (this._storeHashAlgorithm === StoreHashAlgorithm.djb2Hash) {
			return djb2Hash(key, 0, this._storeHashSize);
		}

		// If we have a function, we call it with the store hash size
		if (typeof this._storeHashAlgorithm === 'function') {
			return this._storeHashAlgorithm(key, this._storeHashSize);
		}

		return hashToNumber(key, 0, this._storeHashSize, this._storeHashAlgorithm);
	}

	/**
	 * Clone the value. This is for internal use
	 * @param {any} value - The value to clone
	 * @returns {any} - The cloned value
	 */
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
	 * Resize the LRU cache. This is for internal use.
	 * @returns {void}
	 */
	public lruResize(): void {
		while (this._lru.size > this._lruSize) {
			const oldestKey = this._lru.getOldest();
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
					store.delete(item.key);
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
			/* c8 ignore next 1 */
			if (this._interval) {
				// Be overly cautious and clear the interval as we've unref'd it and we don't want to leak it
				/* c8 ignore next 2 */
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
	public wrap<T, Arguments extends any[]>(function_: (...arguments_: Arguments) => T, options?: WrapFunctionOptions): (...arguments_: Arguments) => T {
		const wrapOptions = {
			ttl: options?.ttl ?? this._ttl,
			keyPrefix: options?.keyPrefix,
			cache: this,
		};

		return wrapSync<T>(function_, wrapOptions);
	}

	private isPrimitive(value: any): boolean {
		const result = false;

		/* c8 ignore next 3 */
		if (value === null || value === undefined) {
			return true;
		}

		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return true;
		}

		return result;
	}

	private setTtl(ttl: number | string | undefined): void {
		if (typeof ttl === 'string' || ttl === undefined) {
			this._ttl = ttl;
		} else if (ttl > 0) {
			this._ttl = ttl;
		} else {
			this._ttl = undefined;
		}
	}

	private hasExpired(item: CacheableStoreItem): boolean {
		if (item.expires && Date.now() > item.expires) {
			return true;
		}

		return false;
	}
}

export type {CacheableItem, CacheableStoreItem} from './cacheable-item-types.js';
