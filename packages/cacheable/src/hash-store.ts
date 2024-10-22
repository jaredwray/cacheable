import {type CacheableStoreItem} from './cacheable-item-types.js';

export class CacheableHashStore {
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

	public get size(): number {
		return this._hash0.size + this._hash1.size + this._hash2.size + this._hash3.size + this._hash4.size + this._hash5.size + this._hash6.size + this._hash7.size + this._hash8.size + this._hash9.size;
	}

	public set(item: CacheableStoreItem) {
		this.getStore(item.key).set(item.key, item);
	}

	public get(key: string) {
		return this.getStore(key).get(key);
	}

	public delete(key: string) {
		return this.getStore(key).delete(key);
	}

	public has(key: string) {
		return this.getStore(key).has(key);
	}

	public clear() {
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
	}

	public concatStores(): Map<string, CacheableStoreItem> {
		const result = new Map([...this._hash0, ...this._hash1, ...this._hash2, ...this._hash3, ...this._hash4, ...this._hash5, ...this._hash6, ...this._hash7, ...this._hash8, ...this._hash9]);
		return result;
	}

	public getStore(key: string) {
		const hash = this.hashKey(key);
		return this.getStoreFromHash(hash);
	}

	public getStoreFromHash(hash: number) {
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
}
