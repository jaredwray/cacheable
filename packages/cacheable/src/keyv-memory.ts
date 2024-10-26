import {type KeyvStoreAdapter, type StoredData} from 'keyv';
import {CacheableMemory, type CacheableMemoryOptions} from './memory.js';

export type KeyvCacheableMemoryOptions = CacheableMemoryOptions & {
	namespace?: string;
};

export class KeyvCacheableMemory implements KeyvStoreAdapter {

	private _defaultCache = new CacheableMemory();
	private _nCache = new Map<string, CacheableMemory>();

	opts: CacheableMemoryOptions = {
		ttl: 0,
		useClone: true,
		lruSize: 0,
		checkInterval: 0,
	};

	namespace?: string;

	constructor(options?: KeyvCacheableMemoryOptions) {
		if (options) {
			this.opts = options;
			this._defaultCache = new CacheableMemory(options);

			if(options.namespace) {
				this.namespace = options.namespace;
				this._nCache.set(this.namespace, new CacheableMemory(options));
			}
		}
	}

	public get store() : CacheableMemory {
		return this.getStore(this.namespace);
	}

	async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
		const result = this.getStore(this.namespace).get<Value>(key);
		if (result) {
			return result;
		}

		return undefined;
	}

	async getMany<Value>(keys: string[]): Promise<Array<StoredData<Value | undefined>>> {
		const result = this.getStore(this.namespace).getMany<Value>(keys);

		return result;
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
		this.getStore(this.namespace).set(key, value, ttl);
	}

	async setMany(values: Array<{key: string; value: any; ttl?: number}>): Promise<void> {
		this.getStore(this.namespace).setMany(values);
	}

	async delete(key: string): Promise<boolean> {
		this.getStore(this.namespace).delete(key);
		return true;
	}

	async deleteMany?(key: string[]): Promise<boolean> {
		this.getStore(this.namespace).deleteMany(key);
		return true;
	}

	async clear(): Promise<void> {
		this.getStore(this.namespace).clear();
	}

	async has?(key: string): Promise<boolean> {
		return this.getStore(this.namespace).has(key);
	}

	on(event: string, listener: (...arguments_: any[]) => void): this {
		return this;
	}

	public getStore(namespace?: string): CacheableMemory {
		if(!namespace) {
			return this._defaultCache;
		}
		
		if (!this._nCache.has(namespace)) {
			this._nCache.set(namespace, new CacheableMemory(this.opts));
		}

		return this._nCache.get(namespace) as CacheableMemory;
	}
}
