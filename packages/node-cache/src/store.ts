import { Stats, shorthandToMilliseconds } from "@cacheable/utils";
import { Hookified } from "hookified";
import type { PartialNodeCacheItem } from "index.js";
import Keyv from "keyv";

export type NodeCacheStoreOptions<T> = {
	/**
	 * Time to live in milliseconds. This is a breaking change from the original NodeCache.
	 */
	ttl?: number | string;
	/**
	 * Maximum number of keys to store in the cache. If this is set to a value greater than 0, the cache will keep track of the number of keys and will not store more than the specified number of keys.
	 */
	maxKeys?: number;
	/**
	 * The Keyv store instance.
	 */
	store?: Keyv<T>;
	/**
	 * Enable stats tracking. This is a breaking change from the original NodeCache.
	 */
	stats?: boolean;
};

export class NodeCacheStore<T> extends Hookified {
	private _maxKeys = 0;
	private _keyv: Keyv<T>;
	private readonly _stats: Stats;
	private _ttl?: number | string;

	constructor(options?: NodeCacheStoreOptions<T>) {
		super();
		this._stats = new Stats({ enabled: options?.stats ?? true });
		this._ttl = options?.ttl;
		this._keyv = options?.store ?? new Keyv<T>();

		if (options?.maxKeys) {
			this._maxKeys = options.maxKeys;
		}

		// Hook up the keyv events
		this._keyv.on("error", (error: Error) => {
			/* v8 ignore next -- @preserve */
			this.emit("error", error);
		});
	}

	/**
	 * Time to live in milliseconds.
	 * @returns {number | string | undefined}
	 * @readonly
	 */
	public get ttl(): number | string | undefined {
		return this._ttl;
	}

	/**
	 * Time to live in milliseconds.
	 * @param {number | string | undefined} ttl
	 */
	public set ttl(ttl: number | string | undefined) {
		this._ttl = ttl;
	}

	/**
	 * The Keyv store instance.
	 * @returns {Keyv<T>}
	 * @readonly
	 */
	public get store(): Keyv<T> {
		return this._keyv;
	}

	/**
	 * Maximum number of keys to store in the cache. if this is set to a value greater than 0,
	 * the cache will keep track of the number of keys and will not store more than the specified number of keys.
	 * @returns {number}
	 * @readonly
	 */
	public get maxKeys(): number {
		return this._maxKeys;
	}

	/**
	 * Maximum number of keys to store in the cache. if this is set to a value greater than 0,
	 * the cache will keep track of the number of keys and will not store more than the specified number of keys.
	 * @param {number} maxKeys
	 */
	public set maxKeys(maxKeys: number) {
		this._maxKeys = maxKeys;
		/* v8 ignore next -- @preserve */
		if (this._maxKeys > 0) {
			this._stats.enabled = true;
		}
	}

	/**
	 * Set a key/value pair in the cache.
	 * @param {string | number} key
	 * @param {T} value
	 * @param {number} [ttl]
	 * @returns {boolean}
	 */
	public async set(
		key: string | number,
		value: T,
		ttl?: number | string,
	): Promise<boolean> {
		const keyStr = key.toString();
		const exists = await this._keyv.get(keyStr);

		if (this._maxKeys > 0) {
			if (exists === undefined && this._stats.count >= this._maxKeys) {
				return false;
			}
		}

		const finalTtl = this.resolveTtl(ttl);
		await this._keyv.set(keyStr, value, finalTtl);

		// Only increment count for new keys
		if (exists === undefined) {
			this._stats.incrementCount();
		}

		return true;
	}

	/**
	 * Set multiple key/value pairs in the cache.
	 * @param {PartialNodeCacheItem[]} list
	 * @returns {void}
	 */
	public async mset(list: Array<PartialNodeCacheItem<T>>): Promise<void> {
		for (const item of list) {
			const keyStr = item.key.toString();
			const exists = await this._keyv.get(keyStr);

			// Check maxKeys limit before each set operation for new keys
			if (this._maxKeys > 0) {
				if (exists === undefined && this._stats.count >= this._maxKeys) {
					// Stop processing if we've reached the limit
					return;
				}
			}

			const finalTtl = this.resolveTtl(item.ttl);
			await this._keyv.set(keyStr, item.value, finalTtl);

			// Only increment count for new keys
			if (exists === undefined) {
				this._stats.incrementCount();
			}
		}
	}

	/**
	 * Get a value from the cache.
	 * @param {string | number} key
	 * @returns {any | undefined}
	 */
	public async get<T>(key: string | number): Promise<T | undefined> {
		const result = await this._keyv.get<T>(key.toString());
		if (result !== undefined) {
			this._stats.incrementHits();
		} else {
			this._stats.incrementMisses();
		}

		return result;
	}

	/**
	 * Get multiple values from the cache.
	 * @param {Array<string | number>} keys
	 * @returns {Record<string, any | undefined>}
	 */
	public async mget<T>(
		keys: Array<string | number>,
	): Promise<Record<string, T | undefined>> {
		const result: Record<string, T | undefined> = {};
		for (const key of keys) {
			result[key.toString()] = await this._keyv.get<T>(key.toString());
		}

		return result;
	}

	/**
	 * Delete a key from the cache.
	 * @param {string | number} key
	 * @returns {boolean}
	 */
	public async del(key: string | number): Promise<boolean> {
		const deleted = await this._keyv.delete(key.toString());
		if (deleted) {
			this._stats.decreaseCount();
		}

		return deleted;
	}

	/**
	 * Delete multiple keys from the cache.
	 * @param {Array<string | number>} keys
	 * @returns {boolean}
	 */
	public async mdel(keys: Array<string | number>): Promise<boolean> {
		const deleted = await this._keyv.delete(keys.map((key) => key.toString()));
		if (deleted) {
			for (const _ of keys) {
				this._stats.decreaseCount();
			}
		}

		return deleted;
	}

	/**
	 * Clear the cache.
	 * @returns {void}
	 */
	public async clear(): Promise<void> {
		await this._keyv.clear();
		this._stats.resetStoreValues();
	}

	/**
	 * Set the TTL of an existing key in the cache.
	 * @param {string | number} key
	 * @param {number | string} [ttl]
	 * @returns {boolean}
	 */
	public async setTtl(
		key: string | number,
		ttl?: number | string,
	): Promise<boolean> {
		const item = await this._keyv.get(key.toString());
		if (item) {
			const finalTtl = this.resolveTtl(ttl);
			await this._keyv.set(key.toString(), item, finalTtl);
			return true;
		}

		return false;
	}

	/**
	 * Get a key from the cache and delete it. If it does exist it will get the value and delete the item from the cache.
	 * @param {string | number} key
	 * @returns {T | undefined}
	 */
	public async take<T>(key: string | number): Promise<T | undefined> {
		const result = await this._keyv.get<T>(key.toString());
		if (result !== undefined) {
			await this._keyv.delete(key.toString());
			this._stats.decreaseCount();
		}

		return result;
	}

	/**
	 * Disconnect from the cache.
	 * @returns {void}
	 */
	public async disconnect(): Promise<void> {
		await this._keyv.disconnect();
	}

	/**
	 * Resolve the TTL to milliseconds.
	 * @param {number | string | undefined} ttl
	 * @returns {number | undefined}
	 */
	private resolveTtl(ttl?: number | string): number | undefined {
		const effectiveTtl = ttl ?? this._ttl;
		if (effectiveTtl === undefined) {
			return undefined;
		}

		if (typeof effectiveTtl === "string") {
			return shorthandToMilliseconds(effectiveTtl);
		}

		return effectiveTtl;
	}
}
