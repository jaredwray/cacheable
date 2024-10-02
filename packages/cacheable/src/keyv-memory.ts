import {type KeyvStoreAdapter, type StoredData} from 'keyv';
import {V} from 'vitest/dist/chunks/environment.C5eAp3K6.js';
import {CacheableMemory, type CacheableMemoryOptions} from './memory.js';

export class KeyvCacheableMemory implements KeyvStoreAdapter {
	opts: CacheableMemoryOptions = {
		ttl: 0,
		useClone: true,
		lruSize: 0,
		checkInterval: 0,
	};

	namespace?: string | undefined;
	private readonly _cache = new CacheableMemory();
	constructor(options?: CacheableMemoryOptions) {
		if (options) {
			this.opts = options;
			this._cache = new CacheableMemory(options);
		}
	}

	async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
		const result = this._cache.get<Value>(key);
		if (result) {
			return result;
		}

		return undefined;
	}

	async getMany<Value>(keys: string[]): Promise<Array<StoredData<Value | undefined>>> {
		const result = this._cache.getMany<Value>(keys);

		return result;
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
		this._cache.set(key, value, ttl);
	}

	async setMany(values: Array<{key: string; value: any; ttl?: number}>): Promise<void> {
		this._cache.setMany(values);
	}

	async delete(key: string): Promise<boolean> {
		this._cache.delete(key);
		return true;
	}

	async deleteMany?(key: string[]): Promise<boolean> {
		this._cache.deleteMany(key);
		return true;
	}

	async clear(): Promise<void> {
		this._cache.clear();
	}

	async has?(key: string): Promise<boolean> {
		return this._cache.has(key);
	}

	on(event: string, listener: (...arguments_: any[]) => void): this {
		return this;
	}
}
