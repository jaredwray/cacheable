import {
	type CacheInstance,
	type GetOrSetFunctionOptions,
	type GetOrSetKey,
	type GetOrSetOptions,
	getOrSet,
	type WrapFunctionOptions,
	wrap,
} from "@cacheable/memoize";
import { createKeyv } from "@cacheable/memory";
import {
	type CacheableItem,
	Stats as CacheableStats,
	calculateTtlFromExpiration,
	getCascadingTtl,
	HashAlgorithm,
	hash,
	shorthandToMilliseconds,
} from "@cacheable/utils";
import { Hookified } from "hookified";
import { Keyv, type KeyvStoreAdapter, type StoredDataRaw } from "keyv";

export enum CacheableHooks {
	BEFORE_SET = "BEFORE_SET",
	AFTER_SET = "AFTER_SET",
	BEFORE_SET_MANY = "BEFORE_SET_MANY",
	AFTER_SET_MANY = "AFTER_SET_MANY",
	BEFORE_GET = "BEFORE_GET",
	AFTER_GET = "AFTER_GET",
	BEFORE_GET_MANY = "BEFORE_GET_MANY",
	AFTER_GET_MANY = "AFTER_GET_MANY",
	BEFORE_SECONDARY_SETS_PRIMARY = "BEFORE_SECONDARY_SETS_PRIMARY",
}

export enum CacheableEvents {
	ERROR = "error",
	CACHE_HIT = "cache:hit",
	CACHE_MISS = "cache:miss",
}

export type CacheableOptions = {
	/**
	 * The primary store for the cacheable instance
	 */
	primary?: Keyv | KeyvStoreAdapter;
	/**
	 * The secondary store for the cacheable instance
	 */
	secondary?: Keyv | KeyvStoreAdapter;
	/**
	 * Whether to enable statistics for the cacheable instance
	 */
	stats?: boolean;
	/**
	 * Whether the secondary store is non-blocking mode. It is set to false by default.
	 * If it is set to true then the secondary store will not block the primary store.
	 */
	nonBlocking?: boolean;
	/**
	 * The time-to-live for the cacheable instance and will be used as the default value.
	 * can be a number in milliseconds or a human-readable format such as `1s` for 1 second or `1h` for 1 hour
	 * or undefined if there is no time-to-live.
	 */
	ttl?: number | string;
	/**
	 * The namespace for the cacheable instance. It can be a string or a function that returns a string.
	 */
	namespace?: string | (() => string);
	/**
	 * The cacheId for the cacheable instance. This is primarily used for the wrap function to not have conflicts.
	 * If it is not set then it will be a random string that is generated
	 */
	cacheId?: string;
};

export class Cacheable extends Hookified {
	private _primary: Keyv = createKeyv();
	private _secondary: Keyv | undefined;
	private _nonBlocking = false;
	private _ttl?: number | string;
	private readonly _stats = new CacheableStats({ enabled: false });
	private _namespace?: string | (() => string);
	private _cacheId: string = Math.random().toString(36).slice(2);

	/**
	 * Creates a new cacheable instance
	 * @param {CacheableOptions} [options] The options for the cacheable instance
	 */
	constructor(options?: CacheableOptions) {
		super();

		if (options?.primary) {
			this.setPrimary(options.primary);
		}

		if (options?.secondary) {
			this.setSecondary(options.secondary);
		}

		if (options?.nonBlocking) {
			this._nonBlocking = options.nonBlocking;
		}

		if (options?.stats) {
			this._stats.enabled = options.stats;
		}

		if (options?.ttl) {
			this.setTtl(options.ttl);
		}

		if (options?.cacheId) {
			this._cacheId = options.cacheId;
		}

		if (options?.namespace) {
			this._namespace = options.namespace;
			this._primary.namespace = this.getNameSpace();
			if (this._secondary) {
				this._secondary.namespace = this.getNameSpace();
			}
		}
	}

	/**
	 * The namespace for the cacheable instance
	 * @returns {string | (() => string) | undefined} The namespace for the cacheable instance
	 */
	public get namespace(): string | (() => string) | undefined {
		return this._namespace;
	}

	/**
	 * Sets the namespace for the cacheable instance
	 * @param {string | (() => string) | undefined} namespace The namespace for the cacheable instance
	 * @returns {void}
	 */
	public set namespace(namespace: string | (() => string) | undefined) {
		this._namespace = namespace;
		this._primary.namespace = this.getNameSpace();
		if (this._secondary) {
			this._secondary.namespace = this.getNameSpace();
		}
	}

	/**
	 * The statistics for the cacheable instance
	 * @returns {CacheableStats} The statistics for the cacheable instance
	 */
	public get stats(): CacheableStats {
		return this._stats;
	}

	/**
	 * The primary store for the cacheable instance
	 * @returns {Keyv} The primary store for the cacheable instance
	 */
	public get primary(): Keyv {
		return this._primary;
	}

	/**
	 * Sets the primary store for the cacheable instance
	 * @param {Keyv} primary The primary store for the cacheable instance
	 */
	public set primary(primary: Keyv) {
		this._primary = primary;
	}

	/**
	 * The secondary store for the cacheable instance
	 * @returns {Keyv | undefined} The secondary store for the cacheable instance
	 */
	public get secondary(): Keyv | undefined {
		return this._secondary;
	}

	/**
	 * Sets the secondary store for the cacheable instance. If it is set to undefined then the secondary store is disabled.
	 * @param {Keyv | undefined} secondary The secondary store for the cacheable instance
	 * @returns {void}
	 */
	public set secondary(secondary: Keyv | undefined) {
		this._secondary = secondary;
	}

	/**
	 * Gets whether the secondary store is non-blocking mode. It is set to false by default.
	 * If it is set to true then the secondary store will not block the primary store.
	 *
	 * [Learn more about non-blocking mode](https://cacheable.org/docs/cacheable/#non-blocking-operations).
	 *
	 * @returns {boolean} Whether the cacheable instance is non-blocking
	 */
	public get nonBlocking(): boolean {
		return this._nonBlocking;
	}

	/**
	 * Sets whether the secondary store is non-blocking mode. It is set to false by default.
	 * If it is set to true then the secondary store will not block the primary store.
	 *
	 * [Learn more about non-blocking mode](https://cacheable.org/docs/cacheable/#non-blocking-operations).
	 *
	 * @param {boolean} nonBlocking Whether the cacheable instance is non-blocking
	 * @returns {void}
	 */
	public set nonBlocking(nonBlocking: boolean) {
		this._nonBlocking = nonBlocking;
	}

	/**
	 * The time-to-live for the cacheable instance and will be used as the default value.
	 * can be a number in milliseconds or a human-readable format such as `1s` for 1 second or `1h` for 1 hour
	 * or undefined if there is no time-to-live.
	 *
	 * [Learn more about time-to-live](https://cacheable.org/docs/cacheable/#shorthand-for-time-to-live-ttl).
	 *
	 * @returns {number | string | undefined} The time-to-live for the cacheable instance in milliseconds, human-readable format or undefined
	 * @example
	 * ```typescript
	 * const cacheable = new Cacheable({ ttl: '1h' });
	 * console.log(cacheable.ttl); // 1h
	 * ```
	 */
	public get ttl(): number | string | undefined {
		return this._ttl;
	}

	/**
	 * Sets the time-to-live for the cacheable instance and will be used as the default value.
	 * If you set a number it is miliseconds, if you set a string it is a human-readable
	 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that
	 * there is no time-to-live.
	 *
	 * [Learn more about time-to-live](https://cacheable.org/docs/cacheable/#shorthand-for-time-to-live-ttl).
	 *
	 * @param {number | string | undefined} ttl The time-to-live for the cacheable instance
	 * @example
	 * ```typescript
	 * const cacheable = new Cacheable();
	 * cacheable.ttl = '1h'; // Set the time-to-live to 1 hour
	 * ```
	 * or setting the time-to-live in milliseconds
	 * ```typescript
	 * const cacheable = new Cacheable();
	 * cacheable.ttl = 3600000; // Set the time-to-live to 1 hour
	 * ```
	 */
	public set ttl(ttl: number | string | undefined) {
		this.setTtl(ttl);
	}

	/**
	 * The cacheId for the cacheable instance. This is primarily used for the wrap function to not have conflicts.
	 * If it is not set then it will be a random string that is generated
	 * @returns {string} The cacheId for the cacheable instance
	 */
	public get cacheId(): string {
		return this._cacheId;
	}

	/**
	 * Sets the cacheId for the cacheable instance. This is primarily used for the wrap function to not have conflicts.
	 * If it is not set then it will be a random string that is generated
	 * @param {string} cacheId The cacheId for the cacheable instance
	 */
	public set cacheId(cacheId: string) {
		this._cacheId = cacheId;
	}

	/**
	 * Sets the primary store for the cacheable instance
	 * @param {Keyv | KeyvStoreAdapter} primary The primary store for the cacheable instance
	 * @returns {void}
	 */
	public setPrimary(primary: Keyv | KeyvStoreAdapter): void {
		if (this.isKeyvInstance(primary)) {
			// If the primary is already a Keyv instance, we can use it directly
			this._primary = primary as Keyv;
		} else {
			this._primary = new Keyv(primary as KeyvStoreAdapter);
		}

		/* c8 ignore next 3 */
		this._primary.on("error", (error: unknown) => {
			this.emit(CacheableEvents.ERROR, error);
		});
	}

	/**
	 * Sets the secondary store for the cacheable instance. If it is set to undefined then the secondary store is disabled.
	 * @param {Keyv | KeyvStoreAdapter} secondary The secondary store for the cacheable instance
	 * @returns {void}
	 */
	public setSecondary(secondary: Keyv | KeyvStoreAdapter): void {
		if (this.isKeyvInstance(secondary)) {
			// If the secondary is already a Keyv instance, we can use it directly
			this._secondary = secondary as Keyv;
		} else {
			this._secondary = new Keyv(secondary as KeyvStoreAdapter);
		}

		/* c8 ignore next 3 */
		this._secondary.on("error", (error: unknown) => {
			this.emit(CacheableEvents.ERROR, error);
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: type format
	public isKeyvInstance(keyv: any): boolean {
		// Check if the object is an instance of Keyv
		if (keyv instanceof Keyv) {
			return true;
		}

		// Check if the object has the Keyv methods and properties
		const keyvMethods = [
			"generateIterator",
			"get",
			"getMany",
			"set",
			"setMany",
			"delete",
			"deleteMany",
			"has",
			"hasMany",
			"clear",
			"disconnect",
			"serialize",
			"deserialize",
		];
		return keyvMethods.every((method) => typeof keyv[method] === "function");
	}

	public getNameSpace(): string | undefined {
		if (typeof this._namespace === "function") {
			return this._namespace();
		}

		return this._namespace;
	}

	/**
	 * Retrieves an entry from the cache, with an optional “raw” mode.
	 *
	 * Checks the primary store first; if not found and a secondary store is configured,
	 * it will fetch from the secondary, repopulate the primary, and return the result.
	 *
	 * @typeParam T - The expected type of the stored value.
	 * @param {string} key - The cache key to retrieve.
	 * @param {{ raw?: boolean }} [opts] - Options for retrieval.
	 * @param {boolean} [opts.raw=false] - If `true`, returns the full raw data object
	 *                                      (`StoredDataRaw<T>`); otherwise returns just the value.
	 * @returns {Promise<T | StoredDataRaw<T> | undefined>}
	 *   A promise that resolves to the cached value (or raw data) if found, or `undefined`.
	 */
	public async get<T>(
		key: string,
		options?: { raw?: false },
	): Promise<T | undefined>;
	public async get<T>(
		key: string,
		options: { raw: true },
	): Promise<StoredDataRaw<T>>;
	public async get<T>(
		key: string,
		options: { raw?: boolean } = {},
	): Promise<T | StoredDataRaw<T>> {
		let result: StoredDataRaw<T>;
		const { raw = false } = options;

		try {
			await this.hook(CacheableHooks.BEFORE_GET, key);
			result = await this._primary.get(key, { raw: true });
			// biome-ignore lint/suspicious/noImplicitAnyLet: allowed
			let ttl;
			// Emit cache hit or miss for primary store
			if (result) {
				this.emit(CacheableEvents.CACHE_HIT, {
					key,
					value: result.value,
					store: "primary",
				});
			} else {
				this.emit(CacheableEvents.CACHE_MISS, { key, store: "primary" });
			}

			if (!result && this._secondary) {
				const secondaryResult = await this.getSecondaryRawResults<T>(key);
				if (secondaryResult?.value) {
					result = secondaryResult;
					// Emit cache hit for secondary store
					this.emit(CacheableEvents.CACHE_HIT, {
						key,
						value: result.value,
						store: "secondary",
					});
					const cascadeTtl = getCascadingTtl(this._ttl, this._primary.ttl);
					const expires = secondaryResult.expires ?? undefined;
					ttl = calculateTtlFromExpiration(cascadeTtl, expires);
					const setItem = { key, value: result.value, ttl };
					await this.hook(
						CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY,
						setItem,
					);
					await this._primary.set(setItem.key, setItem.value, setItem.ttl);
				} else {
					// Emit cache miss for secondary store
					this.emit(CacheableEvents.CACHE_MISS, { key, store: "secondary" });
				}
			}

			await this.hook(CacheableHooks.AFTER_GET, { key, result, ttl });
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			if (result) {
				this._stats.incrementHits();
			} else {
				this._stats.incrementMisses();
			}

			this.stats.incrementGets();
		}

		return raw ? result : result?.value;
	}

	/**
	 * Retrieves multiple entries from the cache.
	 * Checks the primary store for each key; if a key is missing and a secondary store is configured,
	 * it will fetch from the secondary store, repopulate the primary store, and return the results.
	 *
	 * @typeParam T - The expected type of the stored values.
	 * @param {string[]} keys - The cache keys to retrieve.
	 * @param {{ raw?: boolean }} [options] - Options for retrieval.
	 * @param {boolean} [options.raw=false] - When `true`, returns an array of raw data objects (`StoredDataRaw<T>`);
	 *                                        when `false`, returns an array of unwrapped values (`T`) or `undefined` for misses.
	 * @returns {Promise<Array<T | undefined>> | Promise<Array<StoredDataRaw<T>>>}
	 *   A promise that resolves to:
	 *   - `Array<T | undefined>` if `raw` is `false` (default).
	 *   - `Array<StoredDataRaw<T>>` if `raw` is `true`.
	 */
	public async getMany<T>(
		keys: string[],
		options?: { raw?: false },
	): Promise<Array<T | undefined>>;
	public async getMany<T>(
		keys: string[],
		options: { raw: true },
	): Promise<Array<StoredDataRaw<T>>>;
	public async getMany<T>(
		keys: string[],
		options: { raw?: boolean } = {},
	): Promise<Array<T | StoredDataRaw<T>>> {
		let result: Array<StoredDataRaw<T>> = [];
		const { raw = false } = options;

		try {
			await this.hook(CacheableHooks.BEFORE_GET_MANY, keys);
			result = await this._primary.get(keys, { raw: true });
			// Emit cache hits and misses for primary store
			for (const [i, key] of keys.entries()) {
				if (result[i]) {
					this.emit(CacheableEvents.CACHE_HIT, {
						key,
						value: result[i].value,
						store: "primary",
					});
				} else {
					this.emit(CacheableEvents.CACHE_MISS, { key, store: "primary" });
				}
			}
			if (this._secondary) {
				const missingKeys = [];
				for (const [i, key] of keys.entries()) {
					if (!result[i]) {
						missingKeys.push(key);
					}
				}

				const secondaryResults =
					await this.getManySecondaryRawResults<T>(missingKeys);

				let secondaryIndex = 0;
				for await (const [i, key] of keys.entries()) {
					if (!result[i]) {
						const secondaryResult = secondaryResults[secondaryIndex];
						if (secondaryResult && secondaryResult.value !== undefined) {
							result[i] = secondaryResult;
							// Emit cache hit for secondary store
							this.emit(CacheableEvents.CACHE_HIT, {
								key,
								value: secondaryResult.value,
								store: "secondary",
							});

							const cascadeTtl = getCascadingTtl(this._ttl, this._primary.ttl);

							let { expires } = secondaryResult;

							/* c8 ignore next 4 */
							if (expires === null) {
								expires = undefined;
							}

							const ttl = calculateTtlFromExpiration(cascadeTtl, expires);

							const setItem = { key, value: secondaryResult.value, ttl };

							await this.hook(
								CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY,
								setItem,
							);
							await this._primary.set(setItem.key, setItem.value, setItem.ttl);
						} else {
							// Emit cache miss for secondary store
							this.emit(CacheableEvents.CACHE_MISS, {
								key,
								store: "secondary",
							});
						}
						secondaryIndex++;
					}
				}
			}

			await this.hook(CacheableHooks.AFTER_GET_MANY, { keys, result });
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			for (const item of result) {
				if (item) {
					this._stats.incrementHits();
				} else {
					this._stats.incrementMisses();
				}
			}

			this.stats.incrementGets();
		}

		return raw ? result : result.map((item) => item?.value);
	}

	/**
	 * Sets the value of the key. If the secondary store is set then it will also set the value in the secondary store.
	 * @param {string} key the key to set the value of
	 * @param {T} value The value to set
	 * @param {number | string} [ttl] set a number it is miliseconds, set a string it is a human-readable
	 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live.
	 * @returns {boolean} Whether the value was set
	 */
	public async set<T>(
		key: string,
		value: T,
		ttl?: number | string,
	): Promise<boolean> {
		let result = false;
		const finalTtl = shorthandToMilliseconds(ttl ?? this._ttl);
		try {
			const item = { key, value, ttl: finalTtl };
			await this.hook(CacheableHooks.BEFORE_SET, item);
			const promises = [];
			promises.push(this._primary.set(item.key, item.value, item.ttl));
			if (this._secondary) {
				promises.push(this._secondary.set(item.key, item.value, item.ttl));
			}

			if (this._nonBlocking) {
				result = await Promise.race(promises);
				// Catch any rejected promises to avoid unhandled rejections
				for (const promise of promises) {
					promise.catch((error) => {
						this.emit(CacheableEvents.ERROR, error);
					});
				}
			} else {
				const results = await Promise.all(promises);
				result = results[0];
			}

			await this.hook(CacheableHooks.AFTER_SET, item);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			this.stats.incrementKSize(key);
			this.stats.incrementCount();
			this.stats.incrementVSize(value);
			this.stats.incrementSets();
		}

		return result;
	}

	/**
	 * Sets the values of the keys. If the secondary store is set then it will also set the values in the secondary store.
	 * @param {CacheableItem[]} items The items to set
	 * @returns {boolean} Whether the values were set
	 */
	public async setMany(items: CacheableItem[]): Promise<boolean> {
		let result = false;
		try {
			await this.hook(CacheableHooks.BEFORE_SET_MANY, items);
			result = await this.setManyKeyv(this._primary, items);
			if (this._secondary) {
				if (this._nonBlocking) {
					// Catch any errors to avoid unhandled promise rejections
					this.setManyKeyv(this._secondary, items).catch((error) => {
						this.emit(CacheableEvents.ERROR, error);
					});
				} else {
					await this.setManyKeyv(this._secondary, items);
				}
			}

			await this.hook(CacheableHooks.AFTER_SET_MANY, items);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			for (const item of items) {
				this.stats.incrementKSize(item.key);
				this.stats.incrementCount();
				this.stats.incrementVSize(item.value);
			}
		}

		return result;
	}

	/**
	 * Takes the value of the key and deletes the key. If the key does not exist then it will return undefined.
	 * @param {string} key The key to take the value of
	 * @returns {Promise<T | undefined>} The value of the key or undefined if the key does not exist
	 */
	public async take<T>(key: string): Promise<T | undefined> {
		const result = await this.get<T>(key);
		await this.delete(key);

		return result;
	}

	/**
	 * Takes the values of the keys and deletes the keys. If the key does not exist then it will return undefined.
	 * @param {string[]} keys The keys to take the values of
	 * @returns {Promise<Array<T | undefined>>} The values of the keys or undefined if the key does not exist
	 */
	public async takeMany<T>(keys: string[]): Promise<Array<T | undefined>> {
		const result = await this.getMany<T>(keys);
		await this.deleteMany(keys);

		return result;
	}

	/**
	 * Checks if the key exists in the primary store. If it does not exist then it will check the secondary store.
	 * @param {string} key The key to check
	 * @returns {Promise<boolean>} Whether the key exists
	 */
	public async has(key: string): Promise<boolean> {
		const promises = [];
		promises.push(this._primary.has(key));
		if (this._secondary) {
			promises.push(this._secondary.has(key));
		}

		const resultAll = await Promise.all(promises);
		for (const result of resultAll) {
			if (result) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if the keys exist in the primary store. If it does not exist then it will check the secondary store.
	 * @param {string[]} keys The keys to check
	 * @returns {Promise<boolean[]>} Whether the keys exist
	 */
	public async hasMany(keys: string[]): Promise<boolean[]> {
		const result = await this.hasManyKeyv(this._primary, keys);
		const missingKeys = [];
		for (const [i, key] of keys.entries()) {
			if (!result[i] && this._secondary) {
				missingKeys.push(key);
			}
		}

		if (missingKeys.length > 0 && this._secondary) {
			const secondary = await this.hasManyKeyv(this._secondary, keys);
			for (const [i, _key] of keys.entries()) {
				if (!result[i] && secondary[i]) {
					result[i] = secondary[i];
				}
			}
		}

		return result;
	}

	/**
	 * Deletes the key from the primary store. If the secondary store is set then it will also delete the key from the secondary store.
	 * @param {string} key The key to delete
	 * @returns {Promise<boolean>} Whether the key was deleted
	 */
	public async delete(key: string): Promise<boolean> {
		let result = false;
		const promises = [];
		if (this.stats.enabled) {
			const statResult = await this._primary.get<Record<string, unknown>>(key);
			if (statResult) {
				this.stats.decreaseKSize(key);
				this.stats.decreaseVSize(statResult);
				this.stats.decreaseCount();
				this.stats.incrementDeletes();
			}
		}

		promises.push(this._primary.delete(key));
		if (this._secondary) {
			promises.push(this._secondary.delete(key));
		}

		if (this.nonBlocking) {
			result = await Promise.race(promises);
			// Catch any rejected promises to avoid unhandled rejections
			for (const promise of promises) {
				promise.catch((error) => {
					this.emit(CacheableEvents.ERROR, error);
				});
			}
		} else {
			const resultAll = await Promise.all(promises);
			result = resultAll[0];
		}

		return result;
	}

	/**
	 * Deletes the keys from the primary store. If the secondary store is set then it will also delete the keys from the secondary store.
	 * @param {string[]} keys The keys to delete
	 * @returns {Promise<boolean>} Whether the keys were deleted
	 */
	public async deleteMany(keys: string[]): Promise<boolean> {
		if (this.stats.enabled) {
			const statResult = (await this._primary.get(keys)) as unknown;
			for (const key of keys) {
				this.stats.decreaseKSize(key);
				this.stats.decreaseVSize(statResult);
				this.stats.decreaseCount();
				this.stats.incrementDeletes();
			}
		}

		const result = await this.deleteManyKeyv(this._primary, keys);
		if (this._secondary) {
			if (this._nonBlocking) {
				// Catch any errors to avoid unhandled promise rejections
				this.deleteManyKeyv(this._secondary, keys).catch((error) => {
					this.emit(CacheableEvents.ERROR, error);
				});
			} else {
				await this.deleteManyKeyv(this._secondary, keys);
			}
		}

		return result;
	}

	/**
	 * Clears the primary store. If the secondary store is set then it will also clear the secondary store.
	 * @returns {Promise<void>}
	 */
	public async clear(): Promise<void> {
		const promises = [];
		promises.push(this._primary.clear());
		if (this._secondary) {
			promises.push(this._secondary.clear());
		}

		await (this._nonBlocking ? Promise.race(promises) : Promise.all(promises));

		if (this.stats.enabled) {
			this._stats.resetStoreValues();
			this._stats.incrementClears();
		}
	}

	/**
	 * Disconnects the primary store. If the secondary store is set then it will also disconnect the secondary store.
	 * @returns {Promise<void>}
	 */
	public async disconnect(): Promise<void> {
		const promises = [];
		promises.push(this._primary.disconnect());
		if (this._secondary) {
			promises.push(this._secondary.disconnect());
		}

		await (this._nonBlocking ? Promise.race(promises) : Promise.all(promises));
	}

	/**
	 * Wraps a function with caching
	 *
	 * [Learn more about wrapping functions](https://cacheable.org/docs/cacheable/#wrap--memoization-for-sync-and-async-functions).
	 * @param {Function} function_ The function to wrap
	 * @param {WrapOptions} [options] The options for the wrap function
	 * @returns {Function} The wrapped function
	 */
	// biome-ignore lint/suspicious/noExplicitAny: type format
	public wrap<T, Arguments extends any[]>(
		function_: (...arguments_: Arguments) => T,
		options?: WrapFunctionOptions,
	): (...arguments_: Arguments) => T {
		// Create an adapter that converts Cacheable to CacheInstance
		const cacheAdapter: CacheInstance = {
			get: async (key: string) => this.get(key),
			has: async (key: string) => this.has(key),
			// biome-ignore lint/suspicious/noExplicitAny: CacheInstance requires any type
			set: async (key: string, value: any, ttl?: number | string) => {
				await this.set(key, value, ttl);
			},
			/* c8 ignore start */
			// biome-ignore lint/suspicious/noExplicitAny: CacheInstance interface
			on: (event: string, listener: (...args: any[]) => void) => {
				this.on(event, listener);
			},
			/* c8 ignore stop */
			// biome-ignore lint/suspicious/noExplicitAny: CacheInstance requires any type
			emit: (event: string, ...args: any[]) => this.emit(event, ...args),
		};

		const wrapOptions = {
			ttl: options?.ttl ?? this._ttl,
			keyPrefix: options?.keyPrefix,
			createKey: options?.createKey,
			cacheErrors: options?.cacheErrors,
			cache: cacheAdapter,
			cacheId: this._cacheId,
		};

		return wrap<T>(function_, wrapOptions);
	}

	/**
	 * Retrieves the value associated with the given key from the cache. If the key is not found,
	 * invokes the provided function to calculate the value, stores it in the cache, and then returns it.
	 *
	 * @param {GetOrSetKey} key - The key to retrieve or set in the cache. This can also be a function that returns a string key.
	 * If a function is provided, it will be called with the cache options to generate the key.
	 * @param {() => Promise<T>} function_ - The asynchronous function that computes the value to be cached if the key does not exist.
	 * @param {GetOrSetFunctionOptions} [options] - Optional settings for caching, such as the time to live (TTL) or whether to cache errors.
	 * @return {Promise<T | undefined>} - A promise that resolves to the cached or newly computed value, or undefined if an error occurs and caching is not configured for errors.
	 */
	public async getOrSet<T>(
		key: GetOrSetKey,
		function_: () => Promise<T>,
		options?: GetOrSetFunctionOptions,
	): Promise<T | undefined> {
		// Create an adapter that converts Cacheable to CacheInstance
		const cacheAdapter: CacheInstance = {
			get: async (key: string) => this.get(key),
			has: async (key: string) => this.has(key),
			// biome-ignore lint/suspicious/noExplicitAny: CacheInstance requires any type
			set: async (key: string, value: any, ttl?: number | string) => {
				await this.set(key, value, ttl);
			},
			/* c8 ignore start */
			// biome-ignore lint/suspicious/noExplicitAny: CacheInstance interface
			on: (event: string, listener: (...args: any[]) => void) => {
				this.on(event, listener);
			},
			/* c8 ignore stop */
			// biome-ignore lint/suspicious/noExplicitAny: CacheInstance requires any type
			emit: (event: string, ...args: any[]) => this.emit(event, ...args),
		};

		const getOrSetOptions: GetOrSetOptions = {
			cache: cacheAdapter,
			cacheId: this._cacheId,
			ttl: options?.ttl ?? this._ttl,
			cacheErrors: options?.cacheErrors,
			throwErrors: options?.throwErrors,
		};
		return getOrSet(key, function_, getOrSetOptions);
	}

	/**
	 * Will hash an object using the specified algorithm. The default algorithm is 'sha256'.
	 * @param {any} object the object to hash
	 * @param {string} algorithm the hash algorithm to use. The default is 'sha256'
	 * @returns {string} the hash of the object
	 */
	// biome-ignore lint/suspicious/noExplicitAny: type format
	public hash(object: any, algorithm = "sha256"): string {
		// Convert string algorithm to HashAlgorithm enum value if needed
		let hashAlgorithm: HashAlgorithm | undefined;
		if (algorithm === "sha256" || algorithm === HashAlgorithm.SHA256) {
			hashAlgorithm = HashAlgorithm.SHA256;
		} else if (algorithm === "sha512" || algorithm === HashAlgorithm.SHA512) {
			hashAlgorithm = HashAlgorithm.SHA512;
		} else if (algorithm === "md5" || algorithm === HashAlgorithm.MD5) {
			hashAlgorithm = HashAlgorithm.MD5;
		} else if (algorithm === "djb2" || algorithm === HashAlgorithm.DJB2) {
			hashAlgorithm = HashAlgorithm.DJB2;
		} else {
			// Default to SHA256 for unknown algorithms
			hashAlgorithm = HashAlgorithm.SHA256;
		}
		return hash(object, hashAlgorithm);
	}

	private async getSecondaryRawResults<T>(
		key: string,
	): Promise<StoredDataRaw<T> | undefined> {
		// biome-ignore lint/suspicious/noImplicitAnyLet: allowed
		let result;
		if (this._secondary) {
			result = await this._secondary.get(key, { raw: true });
		}

		return result;
	}

	private async getManySecondaryRawResults<T>(
		keys: string[],
	): Promise<Array<StoredDataRaw<T>>> {
		let result: StoredDataRaw<T>[] = [];

		if (this._secondary && keys.length > 0) {
			result = await this._secondary.get(keys, { raw: true });
		}

		return result;
	}

	private async deleteManyKeyv(keyv: Keyv, keys: string[]): Promise<boolean> {
		const promises = [];
		for (const key of keys) {
			promises.push(keyv.delete(key));
		}

		await Promise.all(promises);

		return true;
	}

	private async setManyKeyv(
		keyv: Keyv,
		items: CacheableItem[],
	): Promise<boolean> {
		const promises = [];
		for (const item of items) {
			const finalTtl = shorthandToMilliseconds(item.ttl ?? this._ttl);
			promises.push(keyv.set(item.key, item.value, finalTtl));
		}

		await Promise.all(promises);

		return true;
	}

	private async hasManyKeyv(keyv: Keyv, keys: string[]): Promise<boolean[]> {
		const promises = [];
		for (const key of keys) {
			promises.push(keyv.has(key));
		}

		return Promise.all(promises);
	}

	private setTtl(ttl: number | string | undefined): void {
		if (typeof ttl === "string" || ttl === undefined) {
			this._ttl = ttl;
		} else if (ttl > 0) {
			this._ttl = ttl;
		} else {
			this._ttl = undefined;
		}
	}
}

export {
	type GetOrSetFunctionOptions,
	type GetOrSetKey,
	type GetOrSetOptions,
	getOrSet,
	type WrapOptions,
	type WrapSyncOptions,
	wrap,
	wrapSync,
} from "@cacheable/memoize";
export {
	CacheableMemory,
	type CacheableMemoryOptions,
	createKeyv,
	KeyvCacheableMemory,
	type KeyvCacheableMemoryOptions,
} from "@cacheable/memory";
export {
	type CacheableItem,
	Stats as CacheableStats,
	shorthandToMilliseconds,
	shorthandToTime,
} from "@cacheable/utils";
export { Keyv, KeyvHooks, type KeyvOptions, type KeyvStoreAdapter } from "keyv";
