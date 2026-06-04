import { Stats, shorthandToMilliseconds } from "@cacheable/utils";
import { Hookified } from "hookified";
import type { NodeCacheStats, PartialNodeCacheItem } from "index.js";
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
	/**
	 * If set to true, the cache will clone the returned items via get() functions using structuredClone.
	 * This means mutations to the returned object do not affect the cached copy and vice versa.
	 * Default is false.
	 */
	useClones?: boolean;
	/**
	 * The interval in seconds to check for expired items. 0 = disabled. Default is 0.
	 */
	checkperiod?: number;
	/**
	 * Whether to delete expired items when they are detected. Default is true.
	 */
	deleteOnExpire?: boolean;
};

export class NodeCacheStore<T> extends Hookified {
	private _keyv: Keyv<T>;
	private _ttl?: number | string;
	private _stats: Stats = new Stats({ enabled: true });
	private _useClones: boolean;
	private _deleteOnExpire: boolean;
	private _keys = new Set<string>();
	private _values = new Map<string, T>();
	private _ttls = new Map<string, number>();
	private _intervalId: number | NodeJS.Timeout = 0;

	constructor(options?: NodeCacheStoreOptions<T>) {
		super();
		this._ttl = options?.ttl;
		this._keyv = options?.store ?? new Keyv<T>();
		this._useClones = options?.useClones ?? false;
		this._deleteOnExpire = options?.deleteOnExpire ?? true;

		// Hook up the keyv events
		this._keyv.on("error", (error: Error) => {
			/* v8 ignore next -- @preserve */
			this.emit("error", error);
		});

		this.startInterval(options?.checkperiod);
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
	 * Whether to clone values on get/set.
	 * @returns {boolean}
	 */
	public get useClones(): boolean {
		return this._useClones;
	}

	/**
	 * Whether to clone values on get/set.
	 * @param {boolean} value
	 */
	public set useClones(value: boolean) {
		this._useClones = value;
	}

	/**
	 * Whether to delete expired items when detected.
	 * @returns {boolean}
	 */
	public get deleteOnExpire(): boolean {
		return this._deleteOnExpire;
	}

	/**
	 * Whether to delete expired items when detected.
	 * @param {boolean} value
	 */
	public set deleteOnExpire(value: boolean) {
		this._deleteOnExpire = value;
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
		const keyValue = key.toString();
		const finalTtl = this.resolveTtl(ttl);
		const valueToStore = this._useClones ? this.clone(value) : value;

		const isOverwrite = this._values.has(keyValue);
		this._keys.add(keyValue);
		if (isOverwrite) {
			const oldValue = this._values.get(keyValue) as T;
			this._stats.decreaseKSize(keyValue);
			this._stats.decreaseVSize(oldValue);
			this._stats.decreaseCount();
		}

		await this._keyv.set(keyValue, valueToStore as T, finalTtl);
		this._values.set(keyValue, value);

		this.trackExpiration(keyValue, finalTtl);

		this._stats.incrementKSize(keyValue);
		this._stats.incrementVSize(value);
		this._stats.incrementCount();

		const expirationTimestamp = this._ttls.get(keyValue) ?? 0;
		this.emit("set", keyValue, value, expirationTimestamp);

		return true;
	}

	/**
	 * Set multiple key/value pairs in the cache.
	 * @param {PartialNodeCacheItem[]} list
	 * @returns {void}
	 */
	public async mset(list: Array<PartialNodeCacheItem<T>>): Promise<void> {
		await Promise.all(
			list.map((item) => this.set(item.key, item.value, item.ttl)),
		);
	}

	/**
	 * Get a value from the cache.
	 * @param {string | number} key
	 * @returns {any | undefined}
	 */
	public async get<V = T>(key: string | number): Promise<V | undefined> {
		const keyValue = key.toString();

		if (this.isExpired(keyValue)) {
			await this.handleExpired(keyValue);
			this._stats.incrementMisses();
			return undefined;
		}

		const result = await this._keyv.get<V>(keyValue);
		if (result === undefined) {
			this._stats.incrementMisses();
		} else {
			this._stats.incrementHits();
			if (this._useClones) {
				return this.clone(result) as V;
			}
		}

		return result;
	}

	/**
	 * Get multiple values from the cache.
	 * @param {Array<string | number>} keys
	 * @returns {Record<string, any | undefined>}
	 */
	public async mget<V = T>(
		keys: Array<string | number>,
	): Promise<Record<string, V | undefined>> {
		const result: Record<string, V | undefined> = Object.create(null) as Record<
			string,
			V | undefined
		>;
		await Promise.all(
			keys.map(async (key) => {
				const value = await this.get<V>(key);
				result[key.toString()] = value;
			}),
		);

		return result;
	}

	/**
	 * Delete a key from the cache.
	 * @param {string | number} key
	 * @returns {boolean}
	 */
	public async del(key: string | number): Promise<boolean> {
		const keyValue = key.toString();
		const hadValue = this._values.has(keyValue);
		const value = hadValue ? (this._values.get(keyValue) as T) : undefined;
		const result = await this._keyv.delete(keyValue);
		if (result) {
			this._keys.delete(keyValue);
			this._values.delete(keyValue);
			this._ttls.delete(keyValue);
			this._stats.decreaseKSize(keyValue);
			if (hadValue) {
				this._stats.decreaseVSize(value);
			}

			this._stats.decreaseCount();

			this.emit("del", keyValue, value);
		}

		return result;
	}

	/**
	 * Delete multiple keys from the cache.
	 * @param {Array<string | number>} keys
	 * @returns {boolean}
	 */
	public async mdel(keys: Array<string | number>): Promise<boolean> {
		await Promise.all(keys.map((key) => this.del(key)));
		return true;
	}

	/**
	 * Clear the cache.
	 * @returns {void}
	 */
	public async clear(): Promise<void> {
		await this._keyv.clear();
		this._keys.clear();
		this._values.clear();
		this._ttls.clear();
		this._stats.resetStoreValues();
	}

	/**
	 * Flush all data and stats. Emits a "flush" event.
	 * @returns {void}
	 */
	public async flushAll(): Promise<void> {
		await this._keyv.clear();
		this._keys.clear();
		this._values.clear();
		this._ttls.clear();
		this._stats = new Stats({ enabled: true });
		this.emit("flush");
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
		const keyValue = key.toString();
		if (this._values.has(keyValue)) {
			const item = this._values.get(keyValue) as T;
			const finalTtl = this.resolveTtl(ttl);
			await this._keyv.set(keyValue, item, finalTtl);
			this.trackExpiration(keyValue, finalTtl);
			return true;
		}

		return false;
	}

	/**
	 * Get the TTL of a key. Returns 0 if the key has no TTL (unlimited),
	 * undefined if the key does not exist, or a timestamp in ms of when the key will expire.
	 * @param {string | number} key
	 * @returns {number | undefined}
	 */
	public async getTtl(key: string | number): Promise<number | undefined> {
		const keyValue = key.toString();
		if (!this._keys.has(keyValue)) {
			return undefined;
		}

		const expiration = this._ttls.get(keyValue);
		if (expiration === undefined || expiration === 0) {
			return 0;
		}

		if (expiration > 0 && expiration < Date.now()) {
			await this.handleExpired(keyValue);
			return undefined;
		}

		return expiration;
	}

	/**
	 * Returns an array of all existing keys.
	 * @returns {string[]}
	 */
	public async keys(): Promise<string[]> {
		return [...this._keys];
	}

	/**
	 * Returns boolean indicating if the key is cached and not expired.
	 * @param {string | number} key
	 * @returns {boolean}
	 */
	public async has(key: string | number): Promise<boolean> {
		const keyValue = key.toString();
		if (!this._keys.has(keyValue)) {
			return false;
		}

		if (this.isExpired(keyValue)) {
			await this.handleExpired(keyValue);
			return false;
		}

		return true;
	}

	/**
	 * Get a key from the cache and delete it. If it does exist it will get the value and delete the item from the cache.
	 * @param {string | number} key
	 * @returns {T | undefined}
	 */
	public async take<V = T>(key: string | number): Promise<V | undefined> {
		const keyValue = key.toString();

		if (this.isExpired(keyValue)) {
			await this.handleExpired(keyValue);
			this._stats.incrementMisses();
			return undefined;
		}

		const result = await this._keyv.get<V>(keyValue);
		if (this._values.has(keyValue)) {
			await this._keyv.delete(keyValue);
			this._keys.delete(keyValue);
			this._values.delete(keyValue);
			this._ttls.delete(keyValue);
			this._stats.incrementHits();
			this._stats.decreaseKSize(keyValue);
			this._stats.decreaseVSize(result);
			this._stats.decreaseCount();

			this.emit("del", keyValue, result);

			if (this._useClones) {
				return this.clone(result) as V;
			}
		} else {
			this._stats.incrementMisses();
		}

		return result;
	}

	/**
	 * Gets the stats of the cache
	 * @returns {NodeCacheStats} the stats of the cache
	 */
	public getStats(): NodeCacheStats {
		return {
			keys: this._stats.count,
			hits: this._stats.hits,
			misses: this._stats.misses,
			ksize: this._stats.ksize,
			vsize: this._stats.vsize,
		};
	}

	/**
	 * Flush the stats.
	 * @returns {void}
	 */
	public flushStats(): void {
		this._stats = new Stats({ enabled: true });
		this.emit("flush_stats");
	}

	/**
	 * Disconnect from the cache.
	 * @returns {void}
	 */
	public async disconnect(): Promise<void> {
		this.stopInterval();
		await this._keyv.disconnect();
	}

	/**
	 * Close the cache. Stops the interval timer.
	 * @returns {void}
	 */
	public close(): void {
		this.stopInterval();
	}

	/**
	 * Get the interval id.
	 * @returns {number | NodeJS.Timeout}
	 */
	public getIntervalId(): number | NodeJS.Timeout {
		return this._intervalId;
	}

	/**
	 * Start the check interval for expired items.
	 * @param {number} [checkperiod] interval in seconds
	 */
	public startInterval(checkperiod?: number): void {
		this.stopInterval();
		const period = checkperiod ?? 0;
		if (period > 0) {
			const periodMs = period * 1000;
			this._intervalId = setInterval(() => {
				this.checkData().catch(
					/* v8 ignore next -- @preserve */ (error: Error) => {
						this.emit("error", error);
					},
				);
			}, periodMs).unref();
			return;
		}

		this._intervalId = 0;
	}

	/**
	 * Stop the check interval.
	 */
	public stopInterval(): void {
		if (this._intervalId !== 0) {
			clearInterval(this._intervalId);
			this._intervalId = 0;
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: type format
	private clone(value: any): any {
		if (value === null || value === undefined) {
			return value;
		}

		if (typeof value !== "object") {
			return value;
		}

		return structuredClone(value);
	}

	private isExpired(key: string): boolean {
		const expiration = this._ttls.get(key);
		if (expiration !== undefined && expiration > 0 && expiration < Date.now()) {
			return true;
		}

		return false;
	}

	private async handleExpired(key: string): Promise<void> {
		/* v8 ignore next 3 -- @preserve: race condition guard when key is refreshed between caller's check and this call */
		if (!this.isExpired(key)) {
			return;
		}

		const hadValue = this._values.has(key);
		const value = hadValue ? this._values.get(key) : undefined;

		/* v8 ignore next 3 -- @preserve: race condition guard when key is refreshed during async get */
		if (!this.isExpired(key)) {
			return;
		}

		const wasTracked = this._keys.has(key);

		if (this._deleteOnExpire) {
			await this._keyv.delete(key);
			this._keys.delete(key);
			this._values.delete(key);
			this._ttls.delete(key);
			if (wasTracked) {
				this._stats.decreaseKSize(key);
				if (hadValue) {
					this._stats.decreaseVSize(value);
				}

				this._stats.decreaseCount();
			}
		}

		this.emit("expired", key, value);
	}

	private async checkData(): Promise<void> {
		for (const [key, expiration] of [...this._ttls.entries()]) {
			if (expiration > 0 && expiration < Date.now()) {
				await this.handleExpired(key);
			}
		}
	}

	private trackExpiration(key: string, ttlMs?: number): void {
		if (ttlMs !== undefined && ttlMs > 0) {
			this._ttls.set(key, Date.now() + ttlMs);
		} else {
			this._ttls.set(key, 0);
		}
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
