import {type KeyvStoreAdapter, type StoredData} from 'keyv';
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const result = this._cache.get(key);
		console.log('result', result);
		if (result) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return result;
		}

		return undefined;
	}

	set(key: string, value: any, ttl?: number) {
		this._cache.set(key, value, ttl);
	}

	async delete(key: string): Promise<boolean> {
		this._cache.delete(key);
		return true;
	}

	async clear(): Promise<void> {
		this._cache.clear();
	}

	async has?(key: string): Promise<boolean> {
		return this._cache.has(key);
	}

	async getMany?<Value>(keys: string[]): Promise<Array<StoredData<Value | undefined>>> {
		const result = [];
		for (const key of keys) {
			result.push(this._cache.get(key));
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return result;
	}

	async deleteMany?(key: string[]): Promise<boolean> {
		for (const k of key) {
			this._cache.delete(k);
		}

		return true;
	}

	on(event: string, listener: (...arguments_: any[]) => void): this {
		return this;
	}
}
