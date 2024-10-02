import {wrapSync} from './wrap.js';
import {DoublyLinkedList} from './memory-lru.js';
import {shorthandToTime} from './shorthand-time.js';
import {type CacheableStoreItem, type CacheableItem} from './cacheable-item-types.js';
import {hash} from './hash.js';

export type CacheableMemoryOptions = {
	ttl?: number | string;
	useClone?: boolean;
	lruSize?: number;
	checkInterval?: number;
};

export class CacheableMemory {
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
	private readonly _lru = new DoublyLinkedList<string>();

	private _ttl: number | string | undefined; // Turned off by default
	private _useClone = true; // Turned on by default
	private _lruSize = 0; // Turned off by default
	private _checkInterval = 0; // Turned off by default
	private _interval: number | NodeJS.Timeout = 0; // Turned off by default

	constructor(options?: CacheableMemoryOptions) {
		if (options?.ttl) {
			this.setTtl(options.ttl);
		}

		if (options?.useClone !== undefined) {
			this._useClone = options.useClone;
		}

		if (options?.lruSize) {
			this._lruSize = options.lruSize;
		}

		if (options?.checkInterval) {
			this._checkInterval = options.checkInterval;
		}

		this.startIntervalCheck();
	}

	public get ttl(): number | string | undefined {
		return this._ttl;
	}

	public set ttl(value: number | string | undefined) {
		this.setTtl(value);
	}

	public get useClone(): boolean {
		return this._useClone;
	}

	public set useClone(value: boolean) {
		this._useClone = value;
	}

	public get lruSize(): number {
		return this._lruSize;
	}

	public set lruSize(value: number) {
		this._lruSize = value;
		this.lruResize();
	}

	public get checkInterval(): number {
		return this._checkInterval;
	}

	public set checkInterval(value: number) {
		this._checkInterval = value;
	}

	public get size(): number {
		return this._hash0.size + this._hash1.size + this._hash2.size + this._hash3.size + this._hash4.size + this._hash5.size + this._hash6.size + this._hash7.size + this._hash8.size + this._hash9.size;
	}

	public get keys(): IterableIterator<string> {
		return this.concatStores().keys();
	}

	public get items(): IterableIterator<CacheableStoreItem> {
		return this.concatStores().values();
	}

	public get<T>(key: string): any {
		const store = this.getStore(key);
		const item = store.get(key) as CacheableStoreItem;
		if (!item) {
			return undefined;
		}

		if (item.expires && item.expires && Date.now() > item.expires) {
			store.delete(key);
			return undefined;
		}

		this.lruMoveToFront(key);

		if (!this._useClone) {
			return item.value as T;
		}

		return this.clone(item.value) as T;
	}

	public getMany<T>(keys: string[]): any[] {
		const result = new Array<any>();
		for (const key of keys) {
			result.push(this.get(key) as T);
		}

		return result;
	}

	public getRaw(key: string): CacheableStoreItem | undefined {
		const store = this.getStore(key);
		const item = store.get(key) as CacheableStoreItem;
		if (!item) {
			return undefined;
		}

		if (item.expires && item.expires && Date.now() > item.expires) {
			store.delete(key);
			return undefined;
		}

		this.lruMoveToFront(key);
		return item;
	}

	public getManyRaw(keys: string[]): Array<CacheableStoreItem | undefined> {
		const result = new Array<CacheableStoreItem | undefined>();
		for (const key of keys) {
			result.push(this.getRaw(key));
		}

		return result;
	}

	public set(key: string, value: any, ttl?: number | string): void {
		const store = this.getStore(key);
		let expires;
		if (ttl !== undefined || this._ttl !== undefined) {
			const finalTtl = shorthandToTime(ttl ?? this._ttl);

			if (finalTtl !== undefined) {
				expires = finalTtl;
			}
		}

		if (this._lruSize > 0) {
			if (store.has(key)) {
				this.lruMoveToFront(key);
			} else {
				this.lruAddToFront(key);
				if (this._lru.size > this._lruSize) {
					const oldestKey = this._lru.getOldest();
					if (oldestKey) {
						this._lru.removeOldest();
						this.delete(oldestKey);
					}
				}
			}
		}

		store.set(key, {
			key,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			value,
			expires,
		});
	}

	public setMany(items: CacheableItem[]): void {
		for (const item of items) {
			this.set(item.key, item.value, item.ttl);
		}
	}

	public has(key: string): boolean {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const item = this.get(key);
		return Boolean(item);
	}

	public take<T>(key: string): any {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const item = this.get(key);
		if (!item) {
			return undefined;
		}

		this.delete(key);
		return item as T;
	}

	public takeMany<T>(keys: string[]): any[] {
		const result = new Array<any>();
		for (const key of keys) {
			result.push(this.take(key) as T);
		}

		return result;
	}

	public delete(key: string): void {
		const store = this.getStore(key);
		store.delete(key);
	}

	public deleteMany(keys: string[]): void {
		for (const key of keys) {
			this.delete(key);
		}
	}

	public clear(): void {
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

	public getStore(key: string): Map<string, any> {
		const hashKey = this.hashKey(key);
		switch (hashKey) {
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

	public clone(value: any): any {
		if (this.isPrimitive(value)) {
			return value;
		}

		return structuredClone(value);
	}

	public lruAddToFront(key: string): void {
		if (this._lruSize === 0) {
			return;
		}

		this._lru.addToFront(key);
	}

	public lruMoveToFront(key: string): void {
		if (this._lruSize === 0) {
			return;
		}

		this._lru.moveToFront(key);
	}

	public lruResize(): void {
		if (this._lruSize === 0) {
			return;
		}

		while (this._lru.size > this._lruSize) {
			const oldestKey = this._lru.getOldest();
			if (oldestKey) {
				this._lru.removeOldest();
				this.delete(oldestKey);
			}
		}
	}

	public checkExpiration() {
		const stores = this.concatStores();
		for (const item of stores.values()) {
			if (item.expires && Date.now() > item.expires) {
				this.delete(item.key);
			}
		}
	}

	public startIntervalCheck() {
		if (this._checkInterval > 0) {
			this._interval = setInterval(() => {
				this.checkExpiration();
			}, this._checkInterval);
		}
	}

	public stopIntervalCheck() {
		if (this._interval) {
			clearInterval(this._interval);
		}

		this._interval = 0;
		this._checkInterval = 0;
	}

	public hash(object: any, algorithm = 'sha256'): string {
		return hash(object, algorithm);
	}

	public wrap<T>(function_: (...arguments_: any[]) => T, options: {ttl?: number; key?: string} = {}): (...arguments_: any[]) => T {
		const wrapOptions = {
			ttl: options.ttl,
			key: options.key,
			cache: this,
		};

		return wrapSync<T>(function_, wrapOptions);
	}

	private isPrimitive(value: any): boolean {
		const result = false;

		/* c8 ignore next 3 */
		if (value === null || value === undefined) {
			return true;
		}

		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return true;
		}

		return result;
	}

	private concatStores(): Map<string, CacheableStoreItem> {
		const result = new Map([...this._hash0, ...this._hash1, ...this._hash2, ...this._hash3, ...this._hash4, ...this._hash5, ...this._hash6, ...this._hash7, ...this._hash8, ...this._hash9]);
		return result;
	}

	private setTtl(ttl: number | string | undefined): void {
		if (typeof ttl === 'string' || ttl === undefined) {
			this._ttl = ttl;
		} else if (ttl > 0) {
			this._ttl = ttl;
		} else {
			this._ttl = undefined;
		}
	}
}

export type {CacheableItem, CacheableStoreItem} from './cacheable-item-types.js';
