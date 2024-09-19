import {Cacheable, CacheableMemory, type CacheableItem} from 'cacheable';
import {Keyv} from 'keyv';
import {type NodeCacheItem} from 'index.js';

export type NodeCacheStoreOptions = {
	ttl?: number;
	maxKeys?: number;
	primary?: Keyv;
	secondary?: Keyv;
};

export class NodeCacheStore {
	private _maxKeys = 0;
	private readonly _cache = new Cacheable({primary: new Keyv({store: new CacheableMemory()})});
	constructor(options?: NodeCacheStoreOptions) {
		if (options) {
			const cacheOptions = {
				ttl: options.ttl,
				primary: options.primary,
				secondary: options.secondary,
			};

			this._cache = new Cacheable(cacheOptions);

			if (options.maxKeys) {
				this._maxKeys = options.maxKeys;
				if (this._maxKeys > 0) {
					this._cache.stats.enabled = true;
				}
			}
		}
	}

	public get cache(): Cacheable {
		return this._cache;
	}

	public get ttl(): number | undefined {
		return this._cache.ttl;
	}

	public set ttl(ttl: number | undefined) {
		this._cache.ttl = ttl;
	}

	public get primary(): Keyv {
		return this._cache.primary;
	}

	public set primary(primary: Keyv) {
		this._cache.primary = primary;
	}

	public get secondary(): Keyv | undefined {
		return this._cache.secondary;
	}

	public set secondary(secondary: Keyv | undefined) {
		this._cache.secondary = secondary;
	}

	public get maxKeys(): number {
		return this._maxKeys;
	}

	public set maxKeys(maxKeys: number) {
		this._maxKeys = maxKeys;
		if (this._maxKeys > 0) {
			this._cache.stats.enabled = true;
		}
	}

	public async set(key: string | number, value: any, ttl?: number): Promise<boolean> {
		if (this._maxKeys > 0) {
			if (this._cache.stats.count >= this._maxKeys) {
				return false;
			}
		}

		const finalTtl = ttl ?? this._cache.ttl;

		await this._cache.set(key.toString(), value, finalTtl);
		return true;
	}

	public async mset(list: NodeCacheItem[]): Promise<void> {
		const items = new Array<CacheableItem>();
		for (const item of list) {
			items.push({key: item.key.toString(), value: item.value, ttl: item.ttl});
		}

		await this._cache.setMany(items);
	}

	public async get<T>(key: string | number): Promise<T | undefined> {
		return this._cache.get<T>(key.toString());
	}

	public async mget<T>(keys: Array<string | number>): Promise<Record<string, T | undefined>> {
		const result: Record<string, T | undefined> = {};
		for (const key of keys) {
			// eslint-disable-next-line no-await-in-loop
			result[key.toString()] = await this._cache.get(key.toString());
		}

		return result;
	}

	public async del(key: string | number): Promise<boolean> {
		return this._cache.delete(key.toString());
	}

	public async mdel(keys: Array<string | number>): Promise<boolean> {
		return this._cache.deleteMany(keys.map(key => key.toString()));
	}

	public async clear(): Promise<void> {
		return this._cache.clear();
	}

	public async setTtl(key: string | number, ttl?: number): Promise<boolean> {
		const finalTtl = ttl ?? this._cache.ttl;
		const item = await this._cache.get(key.toString());
		if (item) {
			await this._cache.set(key.toString(), item, finalTtl);
			return true;
		}

		return false;
	}

	public async take<T>(key: string | number): Promise<T | undefined> {
		return this._cache.take<T>(key.toString());
	}

	public async disconnect(): Promise<void> {
		await this._cache.disconnect();
	}
}
