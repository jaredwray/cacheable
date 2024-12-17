import {Hookified} from 'hookified';
import {wrapSync, type WrapFunctionOptions} from './wrap.js';
import {DoublyLinkedList} from './memory-lru.js';
import {shorthandToTime} from './shorthand-time.js';
import {type CacheableStoreItem, type CacheableItem} from './cacheable-item-types.js';
import {hash} from './hash.js';

/**
 * @typedef {Object} CacheableMemoryOptions
 * @property {number|string} [ttl] - Time to Live - If you set a number it is miliseconds, if you set a string it is a human-readable
 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live. If both are
 * undefined then it will not have a time-to-live.
 * @property {boolean} [useClone] - If true, it will clone the value before returning it. If false, it will return the value directly. Default is true.
 * @property {number} [lruSize] - The size of the LRU cache. If set to 0, it will not use LRU cache. Default is 0.
 * @property {number} [checkInterval] - The interval to check for expired items. If set to 0, it will not check for expired items. Default is 0.
 */
export type CacheableMemoryOptions = {
	ttl?: number | string;
	useClone?: boolean;
	lruSize?: number;
	checkInterval?: number;
};

export type SetOptions = {
	ttl?: number | string;
	expire?: number | Date;
};

export class CacheableMemory extends Hookified {
	private _lru = new DoublyLinkedList<string>();
	private readonly _hashCache = new Map<string, number>();
	private readonly _hash0 = new Map<string, CacheableStoreItem>();
	private readonly _hash1 = new Map<string, CacheableStoreItem>();
	private readonly _hash2 = new Map<string, CacheableStoreItem>();
	private readonly _hash3 = new Map<string, CacheableStoreItem>();
	private readonly _hash4 = new Map<string, CacheableStoreItem>();
	private readonly _hash5 = new Map<string, CacheableStoreItem>();
	private readonly _hash6 = new Map<string, CacheableStoreItem>();
	private readonly _hash7 = new Map<string, CacheableStoreItem>();
	private readonly _hash8 = new Map<string, CacheableStoreItem>();
	private readonly _hash9 = new Map<string, CacheableStoreItem>();

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

		if (options?.lruSize) {
			this._lruSize = options.lruSize;
		}

		if (options?.checkInterval) {
			this._checkInterval = options.checkInterval;
		}

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
	 * @returns {number} - The size of the LRU cache. If set to 0, it will not use LRU cache. Default is 0.
	 */
	public get lruSize(): number {
		return this._lruSize;
	}

	/**
	 * Sets the size of the LRU cache
	 * @param {number} value - The size of the LRU cache. If set to 0, it will not use LRU cache. Default is 0.
	 */
	public set lruSize(value: number) {
		this._lruSize = value;
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
		return this._hash0.size + this._hash1.size + this._hash2.size + this._hash3.size + this._hash4.size + this._hash5.size + this._hash6.size + this._hash7.size + this._hash8.size + this._hash9.size;
	}

	/**
	 * Gets the keys
	 * @returns {IterableIterator<string>} - The keys
	 */
	public get keys(): IterableIterator<string> {
		return this.concatStores().keys();
	}

	/**
	 * Gets the items
	 * @returns {IterableIterator<CacheableStoreItem>} - The items
	 */
	public get items(): IterableIterator<CacheableStoreItem> {
		return this.concatStores().values();
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

		if (item.expires && item.expires && Date.now() > item.expires) {
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
		this._hash0.clear();
		this._hash1.clear();
		this._hash2.clear();
		this._hash3.clear();
		this._hash4.clear();
		this._hash5.clear();
		this._hash6.clear();
		this._hash7.clear();
		this._hash8.clear();
		this._hash9.clear();
		this._hashCache.clear();
		this._lru = new DoublyLinkedList<string>();
	}

	/**
	 * Get the store based on the key (internal use)
	 * @param {string} key - The key to get the store
	 * @returns {CacheableHashStore} - The store
	 */
	public getStore(key: string): Map<string, CacheableStoreItem> {
		const hash = this.hashKey(key);
		return this.getStoreFromHash(hash);
	}

	/**
	 * Get the store based on the hash (internal use)
	 * @param {number} hash
	 * @returns {Map<string, CacheableStoreItem>}
	 */
	public getStoreFromHash(hash: number): Map<string, CacheableStoreItem> {
		switch (hash) {
			case 1: {
				return this._hash1;
			}

			case 2: {
				return this._hash2;
			}

			case 3: {
				return this._hash3;
			}

			case 4: {
				return this._hash4;
			}

			case 5: {
				return this._hash5;
			}

			case 6: {
				return this._hash6;
			}

			case 7: {
				return this._hash7;
			}

			case 8: {
				return this._hash8;
			}

			case 9: {
				return this._hash9;
			}

			default: {
				return this._hash0;
			}
		}
	}

	/**
	 * Hash the key (internal use)
	 * @param key
	 * @returns {number} from 0 to 9
	 */
	public hashKey(key: string): number {
		const cacheHashNumber = this._hashCache.get(key)!;
		if (cacheHashNumber) {
			return cacheHashNumber;
		}

		let hash = 0;
		const primeMultiplier = 31; // Use a prime multiplier for better distribution

		for (let i = 0; i < key.length; i++) {
			// eslint-disable-next-line unicorn/prefer-code-point
			hash = (hash * primeMultiplier) + key.charCodeAt(i);
		}

		const result = Math.abs(hash) % 10; // Return a number between 0 and 9
		this._hashCache.set(key, result);
		return result;
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
	 * Resize the LRU cache. This is for internal use
	 * @returns {void}
	 */
	public lruResize(): void {
		if (this._lruSize === 0) {
			return;
		}

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
		const stores = this.concatStores();
		for (const item of stores.values()) {
			if (item.expires && Date.now() > item.expires) {
				this.delete(item.key);
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
	 * Hash the object. This is for internal use
	 * @param {any} object - The object to hash
	 * @param {string} [algorithm='sha256'] - The algorithm to hash
	 * @returns {string} - The hashed string
	 */
	public hash(object: any, algorithm = 'sha256'): string {
		return hash(object, algorithm);
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

	private concatStores(): Map<string, CacheableStoreItem> {
		return new Map([...this._hash0, ...this._hash1, ...this._hash2, ...this._hash3, ...this._hash4, ...this._hash5, ...this._hash6, ...this._hash7, ...this._hash8, ...this._hash9]);
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
}

export type {CacheableItem, CacheableStoreItem} from './cacheable-item-types.js';
