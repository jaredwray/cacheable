import { Cacheable, type CacheableItem, CacheableMemory } from "cacheable";
import { Hookified } from "hookified";
import type { PartialNodeCacheItem } from "index.js";
import { Keyv } from "keyv";

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
	 * Primary cache store.
	 */
	primary?: Keyv<T>;
	/**
	 * Secondary cache store. Learn more about the secondary cache store in the cacheable documentation.
	 * [storage-tiering-and-caching](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable#storage-tiering-and-caching)
	 */
	secondary?: Keyv<T>;

	/**
	 * Enable stats tracking. This is a breaking change from the original NodeCache.
	 */
	stats?: boolean;
};

export class NodeCacheStore<T> extends Hookified {
	private _maxKeys = 0;
	private readonly _cache = new Cacheable({
		primary: new Keyv<T>({ store: new CacheableMemory() }),
	});
	constructor(options?: NodeCacheStoreOptions<T>) {
		super();
		if (options) {
			const cacheOptions = {
				ttl: options.ttl,
				primary: options.primary,
				secondary: options.secondary,
				stats: options.stats ?? true,
			};

			this._cache = new Cacheable(cacheOptions);

			if (options.maxKeys) {
				this._maxKeys = options.maxKeys;
			}
		}

		// Hook up the cacheable events
		this._cache.on("error", (error: Error) => {
			/* c8 ignore next 1 */
			this.emit("error", error);
		});
	}

	/**
	 * Cacheable instance.
	 * @returns {Cacheable}
	 * @readonly
	 */
	public get cache(): Cacheable {
		return this._cache;
	}

	/**
	 * Time to live in milliseconds.
	 * @returns {number | string | undefined}
	 * @readonly
	 */
	public get ttl(): number | string | undefined {
		return this._cache.ttl;
	}

	/**
	 * Time to live in milliseconds.
	 * @param {number | string | undefined} ttl
	 */
	public set ttl(ttl: number | string | undefined) {
		this._cache.ttl = ttl;
	}

	/**
	 * Primary cache store.
	 * @returns {Keyv<T>}
	 * @readonly
	 */
	public get primary(): Keyv<T> {
		return this._cache.primary;
	}

	/**
	 * Primary cache store.
	 * @param {Keyv<T>} primary
	 */
	public set primary(primary: Keyv<T>) {
		this._cache.primary = primary;
	}

	/**
	 * Secondary cache store. Learn more about the secondary cache store in the
	 * [cacheable](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable#storage-tiering-and-caching) documentation.
	 * @returns {Keyv<T> | undefined}
	 */
	public get secondary(): Keyv<T> | undefined {
		return this._cache.secondary;
	}

	/**
	 * Secondary cache store. Learn more about the secondary cache store in the
	 * [cacheable](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable#storage-tiering-and-caching) documentation.
	 * @param {Keyv | undefined} secondary
	 */
	public set secondary(secondary: Keyv | undefined) {
		this._cache.secondary = secondary;
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
		if (this._maxKeys > 0) {
			this._cache.stats.enabled = true;
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
		ttl?: number,
	): Promise<boolean> {
		if (this._maxKeys > 0) {
			if (this._cache.stats.count >= this._maxKeys) {
				return false;
			}
		}

		await this._cache.set(key.toString(), value, ttl);
		return true;
	}

	/**
	 * Set multiple key/value pairs in the cache.
	 * @param {PartialNodeCacheItem[]} list
	 * @returns {void}
	 */
	public async mset(list: Array<PartialNodeCacheItem<T>>): Promise<void> {
		const items: CacheableItem[] = [];
		for (const item of list) {
			items.push({
				key: item.key.toString(),
				value: item.value,
				ttl: item.ttl,
			});
		}

		await this._cache.setMany(items);
	}

	/**
	 * Get a value from the cache.
	 * @param {string | number} key
	 * @returns {any | undefined}
	 */
	public async get<T>(key: string | number): Promise<T | undefined> {
		return this._cache.get<T>(key.toString());
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
			result[key.toString()] = await this._cache.get<T>(key.toString());
		}

		return result;
	}

	/**
	 * Delete a key from the cache.
	 * @param {string | number} key
	 * @returns {boolean}
	 */
	public async del(key: string | number): Promise<boolean> {
		return this._cache.delete(key.toString());
	}

	/**
	 * Delete multiple keys from the cache.
	 * @param {Array<string | number>} keys
	 * @returns {boolean}
	 */
	public async mdel(keys: Array<string | number>): Promise<boolean> {
		return this._cache.deleteMany(keys.map((key) => key.toString()));
	}

	/**
	 * Clear the cache.
	 * @returns {void}
	 */
	public async clear(): Promise<void> {
		return this._cache.clear();
	}

	/**
	 * Check if a key exists in the cache.
	 * @param {string | number} key
	 * @returns {boolean}
	 */
	public async setTtl(key: string | number, ttl?: number): Promise<boolean> {
		const item = await this._cache.get(key.toString());
		if (item) {
			await this._cache.set(key.toString(), item, ttl);
			return true;
		}

		return false;
	}

	/**
	 * Check if a key exists in the cache. If it does exist it will get the value and delete the item from the cache.
	 * @param {string | number} key
	 * @returns {T | undefined}
	 */
	public async take<T>(key: string | number): Promise<T | undefined> {
		return this._cache.take<T>(key.toString());
	}

	/**
	 * Disconnect from the cache.
	 * @returns {void}
	 */
	public async disconnect(): Promise<void> {
		await this._cache.disconnect();
	}
}
