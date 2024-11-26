import {Cacheable, CacheableMemory, type CacheableItem} from 'cacheable';
import {Keyv} from 'keyv';
import {type NodeCacheItem} from 'index.js';
import { Hookified } from 'hookified';

export type NodeCacheStoreOptions = {
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
	primary?: Keyv;
	/**
	 * Secondary cache store. Learn more about the secondary cache store in the cacheable documentation.
	 * [storage-tiering-and-caching](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable#storage-tiering-and-caching)
	 */
	secondary?: Keyv;

	/**
	 * Enable stats tracking. This is a breaking change from the original NodeCache.
	 */
	stats?: boolean;
};

export class NodeCacheStore extends Hookified {
	private _maxKeys = 0;
	private readonly _cache = new Cacheable({primary: new Keyv({store: new CacheableMemory()})});
	constructor(options?: NodeCacheStoreOptions) {
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

		// hook up the cacheable events
		this._cache.on('error', (error: Error) => {
			this.emit('error', error);
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
	 * @returns {Keyv}
	 * @readonly
	 */
	public get primary(): Keyv {
		return this._cache.primary;
	}

	/**
	 * Primary cache store.
	 * @param {Keyv} primary
	 */
	public set primary(primary: Keyv) {
		this._cache.primary = primary;
	}

	/**
	 * Secondary cache store. Learn more about the secondary cache store in the
	 * [cacheable](https://github.com/jaredwray/cacheable/tree/main/packages/cacheable#storage-tiering-and-caching) documentation.
	 * @returns {Keyv | undefined}
	 */
	public get secondary(): Keyv | undefined {
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
	 * @param {any} value
	 * @param {number} [ttl]
	 * @returns {boolean}
	 */
	public async set(key: string | number, value: any, ttl?: number): Promise<boolean> {
		if (this._maxKeys > 0) {
			// eslint-disable-next-line unicorn/no-lonely-if
			if (this._cache.stats.count >= this._maxKeys) {
				return false;
			}
		}

		await this._cache.set(key.toString(), value, ttl);
		return true;
	}

	/**
	 * Set multiple key/value pairs in the cache.
	 * @param {NodeCacheItem[]} list
	 * @returns {void}
	 */
	public async mset(list: NodeCacheItem[]): Promise<void> {
		const items = new Array<CacheableItem>();
		for (const item of list) {
			items.push({key: item.key.toString(), value: item.value, ttl: item.ttl});
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
	public async mget<T>(keys: Array<string | number>): Promise<Record<string, T | undefined>> {
		const result: Record<string, T | undefined> = {};
		for (const key of keys) {
			// eslint-disable-next-line no-await-in-loop
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
		return this._cache.deleteMany(keys.map(key => key.toString()));
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
	 * @returns {any | undefined}
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
