import type { KeyvStoreAdapter, StoredData } from "keyv";

export type CacheManagerStore = {
	name: string;
	isCacheable?: (value: unknown) => boolean;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	get(key: string): Promise<any>;
	mget(...keys: string[]): Promise<unknown[]>;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	set(key: string, value: any, ttl?: number): Promise<any>;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	mset(data: Record<string, any>, ttl?: number): Promise<void>;
	del(key: string): Promise<void>;
	mdel(...keys: string[]): Promise<void>;
	ttl(key: string, ttl?: number): Promise<number>;
	keys(): Promise<string[]>;
	reset?(): Promise<void>;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	on?(event: string, listener: (...arguments_: any[]) => void): void;
	disconnect?(): Promise<void>;
};

export class KeyvAdapter implements KeyvStoreAdapter {
	// biome-ignore lint/suspicious/noExplicitAny: type format
	opts: any;
	namespace?: string | undefined;
	private readonly _cache: CacheManagerStore;
	constructor(store: CacheManagerStore) {
		this._cache = store;
	}

	async get<T>(key: string): Promise<StoredData<T> | undefined> {
		const value = await this._cache.get(key);
		if (value !== undefined && value !== null) {
			return value as T;
		}

		return undefined;
	}

	// biome-ignore lint/suspicious/noExplicitAny: type format
	async set(key: string, value: any, ttl?: number) {
		await this._cache.set(key, value, ttl);
		return true;
	}

	async delete(key: string): Promise<boolean> {
		await this._cache.del(key);
		return true;
	}

	async clear(): Promise<void> {
		return this._cache.reset?.();
	}

	async has?(key: string): Promise<boolean> {
		const result = await this._cache.get(key);
		if (result) {
			return true;
		}

		return false;
	}

	async getMany?<T>(keys: string[]): Promise<Array<StoredData<T | undefined>>> {
		return this._cache
			.mget(...keys)
			.then((values) => values.map((value) => value as T));
	}

	async deleteMany?(key: string[]): Promise<boolean> {
		await this._cache.mdel(...key);
		return true;
	}

	/* c8 ignore next 5 */
	// biome-ignore lint/suspicious/noExplicitAny: type format
	on(event: string, listener: (...arguments_: any[]) => void) {
		this._cache.on?.(event, listener);

		return this;
	}

	async disconnect?(): Promise<void> {
		await this._cache.disconnect?.();
	}
}
