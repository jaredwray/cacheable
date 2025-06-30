/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {CacheableMemory, CacheableStats, shorthandToTime} from 'cacheable';
import {Hookified} from 'hookified';

export type NodeCacheOptions = {
	/**
	 * The standard ttl as number in seconds for every generated cache element. 0 = unlimited, If string, it will be in shorthand format like '1h' for 1 hour
	 */
	stdTTL?: number | string;
	/**
	 * The interval to check for expired items in seconds. Default is 600 = 5 minutes
	 */
	checkperiod?: number;
	/**
	 * If set to true (Default Setting), the cache will clone the returned items via get() functions.
	 * This means that every time you set a value into the cache, node-cache makes a deep clone of it.
	 * When you get that value back, you receive another deep clone.
	 * This mimics the behavior of an external cache like Redis or Memcached, meaning mutations to the
	 * returned object do not affect the cached copy (and vice versa). If set to false, the original
	 * object will be returned, and mutations will affect the cached copy.
	 */
	useClones?: boolean;
	/**
	 * Delete expired items during an interval check or a single item on a get request. Default is true.
	 */
	deleteOnExpire?: boolean;
	/**
	 * The maximum number of keys that will be stored in the cache. Default is -1 = unlimited
	 * If the limit is reached, it will no longer add any new items until some expire.
	 */
	maxKeys?: number;
};

export type NodeCacheItem = {
	/**
	 * The key of the item
	 */
	key: string | number;
	/**
	 * The value of the item
	 */
	value: unknown;
	/**
	 * The ttl of the item in seconds. 0 = unlimited
	 */
	ttl?: number;
};

export enum NodeCacheErrors {
	ECACHEFULL = 'Cache max keys amount exceeded',
	EKEYTYPE = 'The key argument has to be of type `string` or `number`. Found: `__key`',
	EKEYSTYPE = 'The keys argument has to be an array.',
	ETTLTYPE = 'The ttl argument has to be a number or a string for shorthand ttl.',
}

export type NodeCacheStats = {
	/**
	 * The number of keys stored in the cache
	 */
	keys: number;
	/**
	 * The number of hits
	 */
	hits: number;
	/**
	 * The number of misses
	 */
	misses: number;
	/**
	 * The global key size count in approximately bytes
	 */
	ksize: number;
	/**
	 * The global value size count in approximately bytes
	 */
	vsize: number;
};

export class NodeCache extends Hookified {
	public readonly options: NodeCacheOptions = {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		stdTTL: 0,
		checkperiod: 600,
		useClones: true,
		deleteOnExpire: true,
		maxKeys: -1,
	};

	public readonly store = new Map<string, any>();

	private _stats: CacheableStats = new CacheableStats({enabled: true});

	private readonly _cacheable = new CacheableMemory();

	private intervalId: number | NodeJS.Timeout = 0;

	constructor(options?: NodeCacheOptions) {
		super();

		if (options) {
			this.options = {...this.options, ...options};
		}

		this.startInterval();
	}

	/**
	 * Sets a key value pair. It is possible to define a ttl (in seconds). Returns true on success.
	 * @param {string | number} key - it will convert the key to a string
	 * @param {any} value
	 * @param {number | string} [ttl] - this is in seconds and undefined will use the default ttl
	 * @returns {boolean}
	 */
	public set(key: string | number, value: any, ttl?: number | string): boolean {
		// Check on key type
		/* c8 ignore next 3 */
		if (typeof key !== 'string' && typeof key !== 'number') {
			throw this.createError(NodeCacheErrors.EKEYTYPE, key);
		}

		// Check on ttl type
		/* c8 ignore next 3 */
		if (ttl && typeof ttl !== 'number' && typeof ttl !== 'string') {
			throw this.createError(NodeCacheErrors.ETTLTYPE, this.formatKey(key));
		}

		const keyValue = this.formatKey(key);
		let ttlValue = 0;
		if (this.options.stdTTL) {
			ttlValue = this.getExpirationTimestamp(this.options.stdTTL);
		}

		if (ttl) {
			ttlValue = this.getExpirationTimestamp(ttl);
		}

		let expirationTimestamp = 0; // Never delete
		if (ttlValue && ttlValue > 0) {
			expirationTimestamp = ttlValue;
		}

		// Check on max key size
		if (this.options.maxKeys) {
			const {maxKeys} = this.options;
			if (maxKeys > -1 && this.store.size >= maxKeys) {
				throw this.createError(NodeCacheErrors.ECACHEFULL, this.formatKey(key));
			}
		}

		this.store.set(keyValue, {key: keyValue, value, ttl: expirationTimestamp});

		// Event
		this.emit('set', keyValue, value, ttlValue);

		// Add the bytes to the stats
		this._stats.incrementKSize(keyValue);
		this._stats.incrementVSize(value);
		this._stats.setCount(this.store.size);
		return true;
	}

	/**
	 * Sets multiple key val pairs. It is possible to define a ttl (seconds). Returns true on success.
	 * @param {NodeCacheItem[]} data an array of key value pairs with optional ttl
	 * @returns {boolean}
	 */
	public mset(data: NodeCacheItem[]): boolean {
		// Check on keys type
		/* c8 ignore next 3 */
		if (!Array.isArray(data)) {
			throw this.createError(NodeCacheErrors.EKEYSTYPE);
		}

		for (const item of data) {
			this.set(item.key, item.value, item.ttl);
		}

		return true;
	}

	/**
	 * Gets a saved value from the cache. Returns a undefined if not found or expired. If the value was found it returns the value.
	 * @param {string | number} key if the key is a number it will convert it to a string
	 * @returns {T} the value or undefined
	 */
	public get<T>(key: string | number): T | undefined {
		const result = this.store.get(this.formatKey(key));
		if (result) {
			if (result.ttl > 0) {
				if (result.ttl < Date.now()) {
					if (this.options.deleteOnExpire) {
						this.del(key);
					}

					this._stats.incrementMisses();
					// Event
					this.emit('expired', this.formatKey(key), result.value);
					return undefined;
				}

				this._stats.incrementHits();
				if (this.options.useClones) {
					return this._cacheable.clone(result.value) as T;
				}

				return result.value as T;
			}

			this._stats.incrementHits();
			if (this.options.useClones) {
				return this._cacheable.clone(result.value) as T;
			}

			return result.value as T;
		}

		this._stats.incrementMisses();
		return undefined;
	}

	/**
	 * Gets multiple saved values from the cache. Returns an empty object {} if not found or expired.
	 * If the value was found it returns an object with the key value pair.
	 * @param {Array<string | number} keys an array of keys
	 * @returns {Record<string, T | undefined>} an object with the key as a property and the value as the value
	 */
	public mget<T>(keys: Array<string | number>): Record<string, T | undefined> {
		const result: Record<string, T | undefined> = {};

		for (const key of keys) {
			const value = this.get(key);
			if (value) {
				result[this.formatKey(key)] = value as T;
			}
		}

		return result;
	}

	/**
	 * Get the cached value and remove the key from the cache. Equivalent to calling get(key) + del(key).
	 * Useful for implementing single use mechanism such as OTP, where once a value is read it will become obsolete.
	 * @param {string | number} key
	 * @returns {T | undefined} the value or undefined
	 */
	public take<T>(key: string | number): T | undefined {
		const result = this.get(key);

		if (result) {
			this.del(key);
			if (this.options.useClones) {
				return this._cacheable.clone(result) as T;
			}

			return result as T;
		}

		return undefined;
	}

	/**
	 * Delete a key. Returns the number of deleted entries. A delete will never fail.
	 * @param {string | number | Array<string | number>} key if the key is a number it will convert it to a string. if an array is passed it will delete all keys in the array.
	 * @returns {number} if it was successful it will return the count that was deleted
	 */
	public del(key: string | number | Array<string | number>): number {
		if (Array.isArray(key)) {
			return this.mdel(key);
		}

		const result = this.store.get(this.formatKey(key));
		if (result) {
			const keyValue = this.formatKey(key);
			this.store.delete(keyValue);

			// Event
			this.emit('del', keyValue, result.value);

			// Remove the bytes from the stats
			this._stats.decreaseKSize(keyValue);
			this._stats.decreaseVSize(result.value);
			this._stats.setCount(this.store.size);
			return 1;
		}

		return 0;
	}

	/**
	 * Delete all keys in Array that exist. Returns the number of deleted entries.
	 * @param {Array<string | number>} keys an array of keys
	 * @returns {number} the count of deleted keys
	 */
	public mdel(keys: Array<string | number>): number {
		let result = 0;
		for (const key of keys) {
			result += this.del(key);
		}

		return result;
	}

	/**
	 * Redefine the ttl of a key. Returns true if the key has been found and changed.
	 * Otherwise returns false. If the ttl-argument isn't passed the default-TTL will be used.
	 * @param {string | number} key if the key is a number it will convert it to a string
	 * @param {number | string} [ttl] the ttl in seconds if number, or a shorthand string like '1h' for 1 hour
	 * @returns {boolean} true if the key has been found and changed. Otherwise returns false.
	 */
	public ttl(key: string | number, ttl?: number | string): boolean {
		const result = this.store.get(this.formatKey(key));
		if (result) {
			const ttlValue = ttl ?? this.options.stdTTL!;
			result.ttl = this.getExpirationTimestamp(ttlValue);
			this.store.set(this.formatKey(key), result);
			return true;
		}

		return false;
	}

	/**
	 * Receive the ttl of a key.
	 * @param {string | number} key if the key is a number it will convert it to a string
	 * @returns {number | undefined} 0 if this key has no ttl, undefined if this key is not in the cache,
	 * a timestamp in ms representing the time at which this key will expire
	 */
	public getTtl(key: string | number): number | undefined {
		const result = this.store.get(this.formatKey(key));
		if (result) {
			if (result.ttl === 0) {
				return 0;
			}

			return result.ttl as number;
		}

		return undefined;
	}

	/**
	 * Returns an array of all existing keys. [ "all", "my", "keys", "foo", "bar" ]
	 * @returns {string[]} an array of all keys
	 */
	public keys(): string[] {
		const result: string[] = [];

		for (const key of this.store.keys()) {
			result.push(key);
		}

		return result;
	}

	/**
	 * Returns boolean indicating if the key is cached.
	 * @param {string | number} key if the key is a number it will convert it to a string
	 * @returns {boolean} true if the key is cached
	 */
	public has(key: string | number): boolean {
		return this.store.has(this.formatKey(key));
	}

	/**
	 * Gets the stats of the cache
	 * @returns {NodeCacheStats} the stats of the cache
	 */
	public getStats(): NodeCacheStats {
		const stats = {
			keys: this._stats.count,
			hits: this._stats.hits,
			misses: this._stats.misses,
			ksize: this._stats.ksize,
			vsize: this._stats.vsize,
		};

		return stats;
	}

	/**
	 * Flush the whole data.
	 * @returns {void}
	 */
	public flushAll(): void {
		this.store.clear();
		this.flushStats();
		// Event
		this.emit('flush');
	}

	/**
	 * Flush the stats.
	 * @returns {void}
	 */
	public flushStats(): void {
		this._stats = new CacheableStats({enabled: true});
		// Event
		this.emit('flush_stats');
	}

	/**
	 * Close the cache. This will clear the interval timeout which is set on check period option.
	 * @returns {void}
	 */
	public close(): void {
		this.stopInterval();
	}

	/**
	 * Get the interval id
	 * @returns {number | NodeJS.Timeout} the interval id
	 */
	public getIntervalId(): number | NodeJS.Timeout {
		return this.intervalId;
	}

	private formatKey(key: string | number): string {
		return key.toString();
	}

	private getExpirationTimestamp(ttlInSeconds: number | string): number {
		if (typeof ttlInSeconds === 'string') {
			return shorthandToTime(ttlInSeconds);
		}

		const currentTimestamp = Date.now(); // Current time in milliseconds
		const ttlInMilliseconds = ttlInSeconds * 1000; // Convert TTL to milliseconds
		const expirationTimestamp = currentTimestamp + ttlInMilliseconds;
		return expirationTimestamp;
	}

	private startInterval(): void {
		if (this.options.checkperiod && this.options.checkperiod > 0) {
			const checkPeriodinSeconds = this.options.checkperiod * 1000;
			this.intervalId = setInterval(() => {
				this.checkData();
			}, checkPeriodinSeconds).unref();

			return;
		}

		this.intervalId = 0;
	}

	private checkData(): void {
		for (const [key, value] of this.store.entries()) {
			if (value.ttl > 0 && value.ttl < Date.now()) {
				if (this.options.deleteOnExpire) {
					this.del(key);
				}

				this.emit('expired', this.formatKey(key), value.value);
			}
		}
	}

	private stopInterval(): void {
		if (this.intervalId !== 0) {
			clearInterval(this.intervalId);
			this.intervalId = 0;
		}
	}

	private createError(errorCode: string, key?: string): Error {
		let error = errorCode;
		/* c8 ignore next 3 */
		if (key) {
			error = error.replace('__key', key);
		}

		return new Error(error);
	}
}

export {NodeCacheStore, type NodeCacheStoreOptions} from './store.js';
export default NodeCache;
