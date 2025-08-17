// biome-ignore-all lint/suspicious/noExplicitAny: type format
import { Keyv, type KeyvStoreAdapter, type StoredData } from "keyv";
import { CacheableMemory, type CacheableMemoryOptions } from "./memory.js";

export type KeyvCacheableMemoryOptions = CacheableMemoryOptions & {
	namespace?: string;
};

export class KeyvCacheableMemory implements KeyvStoreAdapter {
	opts: CacheableMemoryOptions = {
		ttl: 0,
		useClone: true,
		lruSize: 0,
		checkInterval: 0,
	};

	private readonly _defaultCache = new CacheableMemory();
	private readonly _nCache = new Map<string, CacheableMemory>();
	private _namespace?: string;

	constructor(options?: KeyvCacheableMemoryOptions) {
		if (options) {
			this.opts = options;
			this._defaultCache = new CacheableMemory(options);

			if (options.namespace) {
				this._namespace = options.namespace;
				this._nCache.set(this._namespace, new CacheableMemory(options));
			}
		}
	}

	get namespace(): string | undefined {
		return this._namespace;
	}

	set namespace(value: string | undefined) {
		this._namespace = value;
	}

	public get store(): CacheableMemory {
		return this.getStore(this._namespace);
	}

	async get<Value>(key: string): Promise<StoredData<Value> | undefined> {
		const result = this.getStore(this._namespace).get<Value>(key);
		if (result) {
			return result;
		}

		return undefined;
	}

	async getMany<Value>(
		keys: string[],
	): Promise<Array<StoredData<Value | undefined>>> {
		const result = this.getStore(this._namespace).getMany<Value>(keys);

		return result;
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
		this.getStore(this._namespace).set(key, value, ttl);
	}

	async setMany(
		values: Array<{ key: string; value: any; ttl?: number }>,
	): Promise<void> {
		this.getStore(this._namespace).setMany(values);
	}

	async delete(key: string): Promise<boolean> {
		this.getStore(this._namespace).delete(key);
		return true;
	}

	async deleteMany?(key: string[]): Promise<boolean> {
		this.getStore(this._namespace).deleteMany(key);
		return true;
	}

	async clear(): Promise<void> {
		this.getStore(this._namespace).clear();
	}

	async has?(key: string): Promise<boolean> {
		return this.getStore(this._namespace).has(key);
	}

	on(event: string, listener: (...arguments_: any[]) => void): this {
		this.getStore(this._namespace).on(event, listener);
		return this;
	}

	public getStore(namespace?: string): CacheableMemory {
		if (!namespace) {
			return this._defaultCache;
		}

		if (!this._nCache.has(namespace)) {
			this._nCache.set(namespace, new CacheableMemory(this.opts));
		}

		// biome-ignore lint/style/noNonNullAssertion: need to fix
		return this._nCache.get(namespace)!;
	}
}

/**
 * Creates a new Keyv instance with a new KeyvCacheableMemory store. This also removes the serialize/deserialize methods from the Keyv instance for optimization.
 * @param options
 * @returns
 */
export function createKeyv(options?: KeyvCacheableMemoryOptions): Keyv {
	const store = new KeyvCacheableMemory(options);
	const namespace = options?.namespace;

	// biome-ignore lint/suspicious/noImplicitAnyLet: allowed
	let ttl;
	if (options?.ttl && Number.isInteger(options.ttl)) {
		ttl = options?.ttl as number;
	}

	const keyv = new Keyv({ store, namespace, ttl });
	// Remove seriazlize/deserialize
	keyv.serialize = undefined;
	keyv.deserialize = undefined;
	return keyv;
}
