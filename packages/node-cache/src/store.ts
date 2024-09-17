import {Cacheable, CacheableMemory} from 'cacheable';
import {Keyv} from 'keyv';

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
				primary: options.primary,
				secondary: options.secondary,
			};

			if (options.maxKeys) {
				this._maxKeys = options.maxKeys;
			}

			this._cache = new Cacheable(cacheOptions);
		}
	}

	public get maxKeys(): number {
		return this._maxKeys;
	}

	public set maxKeys(maxKeys: number) {
		this._maxKeys = maxKeys;
	}
}
