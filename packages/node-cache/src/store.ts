import { shorthandToMilliseconds } from "@cacheable/utils";
import { Hookified } from "hookified";
import type { PartialNodeCacheItem } from "index.js";
import Keyv from "keyv";

export type NodeCacheStoreOptions<T> = {
	/**
	 * Time to live in milliseconds. This is a breaking change from the original NodeCache.
	 */
	ttl?: number | string;
	/**
	 * The Keyv store instance.
	 */
	store?: Keyv<T>;
};

export class NodeCacheStore<T> extends Hookified {
	private _keyv: Keyv<T>;
	private _ttl?: number | string;

	constructor(options?: NodeCacheStoreOptions<T>) {
		super();
		this._ttl = options?.ttl;
		this._keyv = options?.store ?? new Keyv<T>();

		// Hook up the keyv events
		this._keyv.on("error", (error: Error) => {
			/* v8 ignore next -- @preserve */
			this.emit("error", error);
		});
	}

	/**
	 * Time to live in milliseconds.
	 * @returns {number | string | undefined}
	 * @readonly
	 */
	public get ttl(): number | string | undefined {
		return this._ttl;
	}

	/**
	 * Time to live in milliseconds.
	 * @param {number | string | undefined} ttl
	 */
	public set ttl(ttl: number | string | undefined) {
		this._ttl = ttl;
	}

	/**
	 * The Keyv store instance.
	 * @returns {Keyv<T>}
	 * @readonly
	 */
	public get store(): Keyv<T> {
		return this._keyv;
	}

	/**
	 * Set a key/value pair in the cache.
	 * @param {string | number} key
	 * @param {T} value
	 * @param {number} [ttl]
	 * @returns {boolean}
	 */
	public async set(
		key: string | number,
		value: T,
		ttl?: number | string,
	): Promise<boolean> {
		const finalTtl = this.resolveTtl(ttl);
		await this._keyv.set(key.toString(), value, finalTtl);
		return true;
	}

	/**
	 * Set multiple key/value pairs in the cache.
	 * @param {PartialNodeCacheItem[]} list
	 * @returns {void}
	 */
	public async mset(list: Array<PartialNodeCacheItem<T>>): Promise<void> {
		for (const item of list) {
			const finalTtl = this.resolveTtl(item.ttl);
			await this._keyv.set(item.key.toString(), item.value, finalTtl);
		}
	}

	/**
	 * Get a value from the cache.
	 * @param {string | number} key
	 * @returns {any | undefined}
	 */
	public async get<V = T>(key: string | number): Promise<V | undefined> {
		return this._keyv.get<V>(key.toString());
	}

	/**
	 * Get multiple values from the cache.
	 * @param {Array<string | number>} keys
	 * @returns {Record<string, any | undefined>}
	 */
	public async mget<V = T>(
		keys: Array<string | number>,
	): Promise<Record<string, V | undefined>> {
		const result: Record<string, V | undefined> = {};
		for (const key of keys) {
			result[key.toString()] = await this._keyv.get<V>(key.toString());
		}

		return result;
	}

	/**
	 * Delete a key from the cache.
	 * @param {string | number} key
	 * @returns {boolean}
	 */
	public async del(key: string | number): Promise<boolean> {
		return this._keyv.delete(key.toString());
	}

	/**
	 * Delete multiple keys from the cache.
	 * @param {Array<string | number>} keys
	 * @returns {boolean}
	 */
	public async mdel(keys: Array<string | number>): Promise<boolean> {
		return this._keyv.delete(keys.map((key) => key.toString()));
	}

	/**
	 * Clear the cache.
	 * @returns {void}
	 */
	public async clear(): Promise<void> {
		await this._keyv.clear();
	}

	/**
	 * Set the TTL of an existing key in the cache.
	 * @param {string | number} key
	 * @param {number | string} [ttl]
	 * @returns {boolean}
	 */
	public async setTtl(
		key: string | number,
		ttl?: number | string,
	): Promise<boolean> {
		const item = await this._keyv.get(key.toString());
		if (item) {
			const finalTtl = this.resolveTtl(ttl);
			await this._keyv.set(key.toString(), item, finalTtl);
			return true;
		}

		return false;
	}

	/**
	 * Get a key from the cache and delete it. If it does exist it will get the value and delete the item from the cache.
	 * @param {string | number} key
	 * @returns {T | undefined}
	 */
	public async take<V = T>(key: string | number): Promise<V | undefined> {
		const result = await this._keyv.get<V>(key.toString());
		if (result !== undefined) {
			await this._keyv.delete(key.toString());
		}

		return result;
	}

	/**
	 * Disconnect from the cache.
	 * @returns {void}
	 */
	public async disconnect(): Promise<void> {
		await this._keyv.disconnect();
	}

	/**
	 * Resolve the TTL to milliseconds.
	 * @param {number | string | undefined} ttl
	 * @returns {number | undefined}
	 */
	private resolveTtl(ttl?: number | string): number | undefined {
		const effectiveTtl = ttl ?? this._ttl;
		if (effectiveTtl === undefined) {
			return undefined;
		}

		if (typeof effectiveTtl === "string") {
			return shorthandToMilliseconds(effectiveTtl);
		}

		// Treat 0 as "unlimited" TTL; Keyv uses undefined to represent no expiration.
		if (effectiveTtl === 0) {
			return undefined;
		}
		return effectiveTtl;
	}
}
