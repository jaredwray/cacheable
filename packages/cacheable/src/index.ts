import { createKeyv } from "@cacheable/memory";
import {
	Stats as CacheableStats,
	type CacheInstance,
	CacheTags,
	calculateTtlFromExpiration,
	type GetOrSetKey,
	type GetOrSetOptions,
	getCascadingTtl,
	getOrSet,
	HashAlgorithm,
	hash,
	hashSync,
	isKeyvInstance,
	type PerStoreTtl,
	resolvePerStoreTtl,
	shorthandToMilliseconds,
	wrap,
} from "@cacheable/utils";
import { type HookFn, Hookified, type IHook } from "hookified";
import {
	Keyv,
	type KeyvEntry,
	type KeyvStoreAdapter,
	type StoredDataRaw,
} from "keyv";
import { CacheableEvents, CacheableHooks } from "./enums.js";
import { CacheableSync, CacheableSyncEvents } from "./sync.js";
import type {
	CacheableAfterGetItem,
	CacheableAfterGetManyItem,
	CacheableHookItem,
	CacheableOptions,
	CacheableSecondarySetsPrimaryItem,
	CacheableSetItem,
	GetOptions,
	GetOrSetFunctionOptions,
	SetOptions,
	WrapFunctionOptions,
} from "./types.js";

/**
 * Maps each {@link CacheableHooks} name to the payload its handler receives, so `onHook` can be
 * strongly typed. Within `BEFORE_SET` you can reassign `item.ttl` (including to a per-store
 * `{ primary, secondary }` object); `BEFORE_SECONDARY_SETS_PRIMARY` only writes the primary store,
 * so its `ttl` is a single value.
 */
export type CacheableHookHandlerMap = {
	[CacheableHooks.BEFORE_SET]: (
		item: CacheableHookItem,
	) => void | Promise<void>;
	[CacheableHooks.AFTER_SET]: (item: CacheableHookItem) => void | Promise<void>;
	[CacheableHooks.BEFORE_SET_MANY]: (
		items: CacheableSetItem[],
	) => void | Promise<void>;
	[CacheableHooks.AFTER_SET_MANY]: (
		items: CacheableSetItem[],
	) => void | Promise<void>;
	[CacheableHooks.BEFORE_GET]: (key: string) => void | Promise<void>;
	[CacheableHooks.AFTER_GET]: (
		item: CacheableAfterGetItem,
	) => void | Promise<void>;
	[CacheableHooks.BEFORE_GET_MANY]: (keys: string[]) => void | Promise<void>;
	[CacheableHooks.AFTER_GET_MANY]: (
		item: CacheableAfterGetManyItem,
	) => void | Promise<void>;
	[CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY]: (
		item: CacheableSecondarySetsPrimaryItem,
	) => void | Promise<void>;
};

export class Cacheable extends Hookified {
	private static _instance?: Cacheable;
	private _primary: Keyv = createKeyv();
	private _secondary: Keyv | undefined;
	private _nonBlocking = false;
	private _ttl?: number | string;
	private _maxTtl?: number | string;
	private readonly _stats = new CacheableStats({ enabled: false });
	private _namespace?: string | (() => string);
	private _cacheId: string = Math.random().toString(36).slice(2);
	private _sync?: CacheableSync;
	private _tags: CacheTags = this.createCacheTags();
	/**
	 * Creates a new cacheable instance
	 * @param {CacheableOptions} [options] The options for the cacheable instance
	 */
	constructor(options?: CacheableOptions) {
		super({ throwOnEmptyListeners: false });

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

		if (options?.maxTtl !== undefined) {
			this.setMaxTtl(options.maxTtl);
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

		if (options?.tags) {
			this._tags.enabled = true;
		}

		if (options?.sync) {
			this._sync =
				options.sync instanceof CacheableSync
					? options.sync
					: new CacheableSync({
							...options.sync,
							namespace: options.namespace,
						});

			// Subscribe to sync events to update local cache
			this._sync.subscribe(this._primary, this._cacheId);
		}
	}

	/**
	 * Gets a shared static (singleton) instance of {@link Cacheable}. The first call creates the
	 * instance using the provided options; every later call returns that same instance. Passing
	 * `options` again after the instance already exists does NOT reconfigure it — the options are
	 * ignored and a {@link CacheableEvents.ERROR} event is emitted on the instance to surface the
	 * conflict (listen with `instance.on("error", ...)`). To reconfigure, replace it via
	 * {@link Cacheable.setStaticInstance} (clear with `undefined`, then call this again).
	 *
	 * Note: this package ships separate CommonJS and ESM builds, so an app that loads both formats
	 * gets one shared instance per build. For a single shared cache, use one module format or share
	 * an explicit instance via {@link Cacheable.setStaticInstance}.
	 * @param {CacheableOptions} [options] Options applied only when the instance is first created
	 * @returns {Cacheable} The shared static instance
	 * @example
	 * ```ts
	 * const cache = Cacheable.getStaticInstance({ ttl: "1h" });
	 * await cache.set("key", "value");
	 * ```
	 */
	public static getStaticInstance(options?: CacheableOptions): Cacheable {
		if (options && Cacheable._instance) {
			Cacheable._instance.emit(
				CacheableEvents.ERROR,
				new Error(
					"Cacheable static instance is already initialized; the options passed were ignored. To reconfigure, use Cacheable.setStaticInstance().",
				),
			);
			return Cacheable._instance;
		}
		Cacheable._instance ??= new Cacheable(options);
		return Cacheable._instance;
	}

	/**
	 * Sets or clears the shared static instance returned by {@link Cacheable.getStaticInstance}.
	 * Pass a {@link Cacheable} instance to make it the shared instance, or `undefined` to clear it
	 * so the next {@link Cacheable.getStaticInstance} call creates a fresh one. Clearing only drops
	 * the reference — it does not `disconnect()` or `clear()` the previous instance, so disconnect
	 * it first if it holds open connections.
	 * @param {Cacheable} [instance] The instance to share, or `undefined` to clear it
	 */
	public static setStaticInstance(instance?: Cacheable): void {
		Cacheable._instance = instance;
	}

	/**
	 * Registers a handler for a hook. Built-in {@link CacheableHooks} names get a strongly-typed
	 * payload (e.g. `BEFORE_SET` receives a {@link CacheableHookItem} whose `ttl` you can reassign);
	 * any other event name falls back to the loose Hookified signature.
	 * @param hook The hook to register the handler for
	 * @param handler The handler to call when the hook is triggered
	 */
	public onHook<K extends CacheableHooks>(
		hook: K,
		handler: CacheableHookHandlerMap[K],
	): IHook | undefined;
	public onHook(event: string, handler: HookFn): IHook | undefined;
	public onHook(event: string, handler: HookFn): IHook | undefined {
		return super.onHook(event, handler);
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

		if (this._sync) {
			this._sync.namespace = namespace;
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
		this._tags = this.createCacheTags();
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
		this._tags = this.createCacheTags();
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
	 * Gets the maximum time-to-live for the cacheable instance. When set, any TTL that exceeds this
	 * value is capped to maxTtl. Entries with no TTL will also be capped to maxTtl.
	 * Can be a number in milliseconds or a human-readable format such as `1s`, `1m`, `1h`, `1d`.
	 * Default is `undefined` (no maximum).
	 *
	 * @returns {number | string | undefined} The maximum time-to-live or undefined if not set
	 * @example
	 * ```typescript
	 * const cacheable = new Cacheable({ maxTtl: '1h' });
	 * console.log(cacheable.maxTtl); // '1h'
	 * ```
	 */
	public get maxTtl(): number | string | undefined {
		return this._maxTtl;
	}

	/**
	 * Sets the maximum time-to-live for the cacheable instance. When set, any TTL that exceeds this
	 * value is capped to maxTtl. Entries with no TTL will also be capped to maxTtl.
	 * If you set a number it is milliseconds, if you set a string it is a human-readable
	 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined disables the maximum.
	 *
	 * @param {number | string | undefined} maxTtl The maximum time-to-live
	 * @example
	 * ```typescript
	 * const cacheable = new Cacheable();
	 * cacheable.maxTtl = '1h'; // Set the max TTL to 1 hour
	 * ```
	 */
	public set maxTtl(maxTtl: number | string | undefined) {
		this.setMaxTtl(maxTtl);
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
	 * Gets the sync instance for the cacheable instance
	 * @returns {CacheableSync | undefined} The sync instance for the cacheable instance
	 */
	public get sync(): CacheableSync | undefined {
		return this._sync;
	}

	/**
	 * Sets the sync instance for the cacheable instance
	 * @param {CacheableSync | undefined} sync The sync instance for the cacheable instance
	 */
	public set sync(sync: CacheableSync | undefined) {
		this._sync = sync;

		if (this._sync) {
			// Subscribe to sync events to update local cache
			this._sync.subscribe(this._primary, this._cacheId);
		}
	}

	/**
	 * The tag service for the cacheable instance, used for tag-based invalidation. It is created
	 * by default in the constructor and persists tag metadata in the secondary store when one is
	 * configured (so invalidations are shared across instances), otherwise the primary store.
	 *
	 * The service starts disabled so untagged workloads pay no extra store reads, and must be
	 * explicitly enabled to use tags — via the `tags: true` option or the `tags.enabled`
	 * property. While disabled, all tag operations are no-ops. Enable it on every instance that
	 * shares the store so behavior is consistent across distributed instances. While enabled,
	 * `get` / `getMany` perform tag freshness checks and remove stale entries.
	 *
	 * [Learn more about tag-based invalidation](https://cacheable.org/docs/cacheable/#tag-based-invalidation).
	 *
	 * @returns {CacheTags} The tag service for the cacheable instance
	 * @example
	 * ```typescript
	 * const cache = new Cacheable({ tags: true });
	 * await cache.set('page:/products', html, { tags: ['entity:42'] });
	 * await cache.tags.invalidateTag('entity:42');
	 * await cache.get('page:/products'); // undefined
	 * ```
	 */
	public get tags(): CacheTags {
		return this._tags;
	}

	/**
	 * Creates the tag service backed by the secondary store when one is configured, otherwise the
	 * primary store, preserving the enabled state of any previous service and reporting
	 * non-blocking failures as error events.
	 */
	private createCacheTags(): CacheTags {
		return new CacheTags({
			store: this._secondary ?? this._primary,
			enabled: this._tags?.enabled ?? false,
			onError: (error: unknown) => {
				this.emit(CacheableEvents.ERROR, error);
			},
		});
	}

	/**
	 * Sets the primary store for the cacheable instance
	 * @param {Keyv | KeyvStoreAdapter} primary The primary store for the cacheable instance
	 * @returns {void}
	 */
	public setPrimary(primary: Keyv | KeyvStoreAdapter): void {
		if (isKeyvInstance(primary)) {
			// If the primary is already a Keyv instance, we can use it directly
			this._primary = primary as Keyv;
		} else {
			this._primary = new Keyv(primary as KeyvStoreAdapter);
		}

		/* v8 ignore next -- @preserve */
		this._primary.on("error", (error: unknown) => {
			this.emit(CacheableEvents.ERROR, error);
		});

		this._tags = this.createCacheTags();
	}

	/**
	 * Sets the secondary store for the cacheable instance. If it is set to undefined then the secondary store is disabled.
	 * @param {Keyv | KeyvStoreAdapter} secondary The secondary store for the cacheable instance
	 * @returns {void}
	 */
	public setSecondary(secondary: Keyv | KeyvStoreAdapter): void {
		if (isKeyvInstance(secondary)) {
			// If the secondary is already a Keyv instance, we can use it directly
			this._secondary = secondary as Keyv;
		} else {
			this._secondary = new Keyv(secondary as KeyvStoreAdapter);
		}

		/* v8 ignore next -- @preserve */
		this._secondary.on("error", (error: unknown) => {
			this.emit(CacheableEvents.ERROR, error);
		});

		this._tags = this.createCacheTags();
	}

	public getNameSpace(): string | undefined {
		if (typeof this._namespace === "function") {
			return this._namespace();
		}

		return this._namespace;
	}

	/**
	 * Retrieves an entry from the cache.
	 *
	 * Checks the primary store first; if not found and a secondary store is configured,
	 * it will fetch from the secondary, repopulate the primary, and return the result.
	 *
	 * @typeParam T - The expected type of the stored value.
	 * @param {string} key - The cache key to retrieve.
	 * @param {GetOptions} - options such as to bypass `nonBlocking` for this call
	 * @returns {Promise<T | undefined>}
	 *   A promise that resolves to the cached value if found, or `undefined`.
	 */
	public async get<T>(
		key: string,
		options?: GetOptions,
	): Promise<T | undefined> {
		const result = await this.getRaw<T>(key, options);
		return result?.value;
	}

	/**
	 * Retrieves the raw entry from the cache including metadata like expiration.
	 *
	 * Checks the primary store first; if not found and a secondary store is configured,
	 * it will fetch from the secondary, repopulate the primary, and return the result.
	 *
	 * @typeParam T - The expected type of the stored value.
	 * @param {string} key - The cache key to retrieve.
	 * @param {GetOptions} - options such as to bypass `nonBlocking` for this call
	 * @returns {Promise<StoredDataRaw<T>>}
	 *   A promise that resolves to the full raw data object if found, or undefined.
	 */
	public async getRaw<T>(
		key: string,
		options?: GetOptions,
	): Promise<StoredDataRaw<T>> {
		let result: StoredDataRaw<T>;

		try {
			await this.hook(CacheableHooks.BEFORE_GET, key);
			result = await this._primary.getRaw(key);
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

			const nonBlocking = options?.nonBlocking ?? this._nonBlocking;

			if (!result && this._secondary) {
				let secondaryProcessResult:
					| {
							result: StoredDataRaw<T>;
							ttl?: number | string;
					  }
					| undefined;
				if (nonBlocking) {
					secondaryProcessResult =
						await this.processSecondaryForGetRawNonBlocking<T>(
							this._primary,
							this._secondary,
							key,
						);
				} else {
					secondaryProcessResult = await this.processSecondaryForGetRaw<T>(
						this._primary,
						this._secondary,
						key,
					);
				}
				if (secondaryProcessResult) {
					result = secondaryProcessResult.result;
					ttl = secondaryProcessResult.ttl;
				}
			}

			if (result && this._tags.enabled && (await this._tags.isKeyStale(key))) {
				await this.delete(key);
				result = undefined;
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

		return result;
	}

	/**
	 * Retrieves multiple raw entries from the cache including metadata like expiration.
	 *
	 * Checks the primary store for each key; if a key is missing and a secondary store is configured,
	 * it will fetch from the secondary store, repopulate the primary store, and return the results.
	 *
	 * @typeParam T - The expected type of the stored values.
	 * @param {string[]} keys - The cache keys to retrieve.
	 * @param {GetOptions} - options such as to bypass `nonBlocking` on this call
	 * @returns {Promise<Array<StoredDataRaw<T>>>}
	 *   A promise that resolves to an array of raw data objects.
	 */
	public async getManyRaw<T>(
		keys: string[],
		options?: GetOptions,
	): Promise<Array<StoredDataRaw<T>>> {
		let result: Array<StoredDataRaw<T>> = [];

		try {
			await this.hook(CacheableHooks.BEFORE_GET_MANY, keys);
			result = await this._primary.getManyRaw(keys);
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

			const nonBlocking = options?.nonBlocking ?? this._nonBlocking;

			if (this._secondary) {
				if (nonBlocking) {
					await this.processSecondaryForGetManyRawNonBlocking(
						this._primary,
						this._secondary,
						keys,
						result,
					);
				} else {
					await this.processSecondaryForGetManyRaw(
						this._primary,
						this._secondary,
						keys,
						result,
					);
				}
			}

			if (this._tags.enabled) {
				const presentKeys = keys.filter((_, i) => result[i] !== undefined);
				const staleKeys = await this._tags.getStaleKeys(presentKeys);
				if (staleKeys.length > 0) {
					const staleSet = new Set(staleKeys);
					for (const [i, key] of keys.entries()) {
						if (staleSet.has(key)) {
							result[i] = undefined;
						}
					}

					await this.deleteMany(staleKeys);
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

		return result;
	}

	/**
	 * Retrieves multiple entries from the cache.
	 * Checks the primary store for each key; if a key is missing and a secondary store is configured,
	 * it will fetch from the secondary store, repopulate the primary store, and return the results.
	 *
	 * @typeParam T - The expected type of the stored values.
	 * @param {string[]} keys - The cache keys to retrieve.
	 * @param {GetOptions} - options such as to bypass `nonBlocking` on this call
	 * @returns {Promise<Array<T | undefined>>}
	 *   A promise that resolves to an array of cached values or `undefined` for misses.
	 */
	public async getMany<T>(
		keys: string[],
		options?: GetOptions,
	): Promise<Array<T | undefined>> {
		const result = await this.getManyRaw<T>(keys, options);
		return result.map((item) => item?.value);
	}

	/**
	 * Sets the value of the key. If the secondary store is set then it will also set the value in the secondary store.
	 * @param {string} key the key to set the value of
	 * @param {T} value The value to set
	 * @param {number | string | SetOptions} [ttlOrOptions] set a number it is miliseconds, set a string it is a human-readable
	 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live.
	 * You can also pass a {@link SetOptions} object such as `{ ttl: '1h', tags: ['user:42'] }` to associate the entry with
	 * tags for tag-based invalidation. To give each store its own TTL for this operation, pass a per-store object as the
	 * `ttl`, such as `{ ttl: { primary: '10s', secondary: '5m' } }`.
	 * @returns {boolean} Whether the value was set
	 */
	public async set<T>(
		key: string,
		value: T,
		ttlOrOptions?: number | string | SetOptions,
	): Promise<boolean> {
		let result = false;
		const options: SetOptions =
			typeof ttlOrOptions === "object" && ttlOrOptions !== null
				? ttlOrOptions
				: { ttl: ttlOrOptions ?? undefined };
		const nonBlocking = options.nonBlocking ?? this._nonBlocking;
		const { primary: explicitPrimaryTtl, secondary: explicitSecondaryTtl } =
			resolvePerStoreTtl(options.ttl);
		const maxTtlMs = shorthandToMilliseconds(this._maxTtl);
		try {
			let primaryTtl = getCascadingTtl(
				this._ttl,
				this._primary.ttl,
				explicitPrimaryTtl,
			);
			primaryTtl = this.capTtl(primaryTtl, maxTtlMs);
			// Build the hook item with a tracked `ttl` accessor so we can tell whether the
			// BEFORE_SET handler explicitly assigned a ttl — assigning the same value still counts
			// as an override. The handler may assign a number, a shorthand string, or a per-store
			// object (`{ primary, secondary }`) to give each store its own expiration.
			let hookTtl: number | string | PerStoreTtl | undefined = primaryTtl;
			let ttlOverridden = false;
			const item = {
				key,
				value,
				tags: options.tags,
				get ttl(): number | string | PerStoreTtl | undefined {
					return hookTtl;
				},
				set ttl(value: number | string | PerStoreTtl | undefined) {
					hookTtl = value;
					ttlOverridden = true;
				},
			};
			await this.hook(CacheableHooks.BEFORE_SET, item);

			// Resolve the effective per-store ttls from whatever the hook left behind. When the hook
			// did not touch the ttl, each store keeps its own cascade (today's behavior). When the
			// hook set a per-store object, each field is honored independently and an omitted field
			// falls back to that store's cascade. A scalar applies to every store.
			let primaryTtlEffective: number | undefined;
			let secondaryTtlEffective: number | undefined;
			if (!ttlOverridden) {
				primaryTtlEffective = primaryTtl;
				secondaryTtlEffective = this._secondary
					? getCascadingTtl(
							this._ttl,
							this._secondary.ttl,
							explicitSecondaryTtl,
						)
					: undefined;
			} else if (typeof hookTtl === "object" && hookTtl !== null) {
				const { primary: hookPrimaryTtl, secondary: hookSecondaryTtl } =
					resolvePerStoreTtl(hookTtl);
				primaryTtlEffective =
					hookPrimaryTtl ??
					getCascadingTtl(this._ttl, this._primary.ttl, explicitPrimaryTtl);
				secondaryTtlEffective = this._secondary
					? (hookSecondaryTtl ??
						getCascadingTtl(
							this._ttl,
							this._secondary.ttl,
							explicitSecondaryTtl,
						))
					: undefined;
			} else {
				const hookScalarTtl = shorthandToMilliseconds(hookTtl);
				primaryTtlEffective = hookScalarTtl;
				secondaryTtlEffective = this._secondary ? hookScalarTtl : undefined;
			}
			primaryTtlEffective = this.capTtl(primaryTtlEffective, maxTtlMs);
			secondaryTtlEffective = this.capTtl(secondaryTtlEffective, maxTtlMs);
			// Normalize the hook item's ttl to the effective primary number so AFTER_SET handlers
			// and sync replication observe a number, never the per-store object.
			hookTtl = primaryTtlEffective;

			// The tag snapshot must outlive the longest-lived copy of the value across the stores;
			// otherwise the snapshot could expire while a copy is still cached, and a later
			// invalidation would no longer be able to mark that copy as stale.
			const tagTtl = this.maxStoreTtl(
				primaryTtlEffective,
				secondaryTtlEffective,
			);
			const promises = [];
			promises.push(
				this._primary.set(item.key, item.value, primaryTtlEffective),
			);
			if (this._secondary) {
				promises.push(
					this._secondary.set(item.key, item.value, secondaryTtlEffective),
				);
			}

			if (nonBlocking) {
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

			if (this._tags.enabled) {
				if (item.tags && item.tags.length > 0) {
					await this._tags.setKeyTags(item.key, item.tags, {
						ttl: tagTtl,
						nonBlocking,
					});
				} else {
					// Remove any previous tag snapshot so a stale one cannot invalidate this fresh value
					await this._tags.removeKeys([item.key], { nonBlocking });
				}
			}

			await this.hook(CacheableHooks.AFTER_SET, item);

			// Publish to sync if enabled
			if (this._sync && result) {
				await this._sync.publish(CacheableSyncEvents.SET, {
					cacheId: this._cacheId,
					key: item.key,
					value: item.value,
					ttl: primaryTtlEffective,
				});
			}
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
	 * Items can include `tags` to associate the entry with tags for tag-based invalidation.
	 * @param {CacheableSetItem[]} items The items to set
	 * @returns {boolean} Whether the values were set
	 */
	public async setMany(items: CacheableSetItem[]): Promise<boolean> {
		let result = false;
		try {
			await this.hook(CacheableHooks.BEFORE_SET_MANY, items);
			result = await this.setManyKeyv(this._primary, items, "primary");
			if (this._secondary) {
				if (this._nonBlocking) {
					// Catch any errors to avoid unhandled promise rejections
					const secondaryPromise = this.setManyKeyv(
						this._secondary,
						items,
						"secondary",
					);
					/* v8 ignore next -- @preserve */
					secondaryPromise.catch((error) => {
						/* v8 ignore next -- @preserve */
						this.emit(CacheableEvents.ERROR, error);
					});
				} else {
					await this.setManyKeyv(this._secondary, items, "secondary");
				}
			}

			if (this._tags.enabled) {
				await this.setManyKeyTags(items);
			}

			await this.hook(CacheableHooks.AFTER_SET_MANY, items);

			// Publish to sync if enabled
			if (this._sync && result) {
				const maxTtlMs = shorthandToMilliseconds(this._maxTtl);
				for (const item of items) {
					await this._sync.publish(CacheableSyncEvents.SET, {
						cacheId: this._cacheId,
						key: item.key,
						value: item.value,
						// Replicate the effective primary ttl actually written (cascade + maxTtl),
						// not just the explicit per-store field, so subscribers stay in sync.
						ttl: this.resolveStoreTtl(
							item.ttl,
							this._primary.ttl,
							"primary",
							maxTtlMs,
						),
					});
				}
			}
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
		const result = await this._primary.hasMany(keys);
		const missingKeys = [];
		for (const [i, key] of keys.entries()) {
			if (!result[i] && this._secondary) {
				missingKeys.push(key);
			}
		}

		if (missingKeys.length > 0 && this._secondary) {
			const secondary = await this._secondary.hasMany(keys);
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
			/* v8 ignore next -- @preserve */
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

		if (this._tags.enabled) {
			await this._tags.removeKeys([key], { nonBlocking: this.nonBlocking });
		}

		// Publish to sync if enabled
		if (this._sync && result) {
			await this._sync.publish(CacheableSyncEvents.DELETE, {
				cacheId: this._cacheId,
				key,
			});
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

		const result = await this._primary.deleteMany(keys);
		if (this._secondary) {
			if (this._nonBlocking) {
				// Catch any errors to avoid unhandled promise rejections
				this._secondary.deleteMany(keys).catch((error) => {
					this.emit(CacheableEvents.ERROR, error);
				});
			} else {
				await this._secondary.deleteMany(keys);
			}
		}

		if (this._tags.enabled) {
			await this._tags.removeKeys(keys, { nonBlocking: this._nonBlocking });
		}

		// Publish to sync if enabled
		if (this._sync && result) {
			for (const key of keys) {
				await this._sync.publish(CacheableSyncEvents.DELETE, {
					cacheId: this._cacheId,
					key,
				});
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
		/* v8 ignore next -- @preserve */
		if (this._secondary) {
			promises.push(this._secondary.disconnect());
		}

		promises.push(this._sync?.qified.disconnect());

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
			/* v8 ignore next -- @preserve */
			has: async (key: string) => this.has(key),

			set: async (
				key: string,
				value: unknown,
				ttl?: number | string | PerStoreTtl,
			) => {
				await this.set(key, value, { ttl });
			},
			/* v8 ignore next -- @preserve */
			on: (event: string, listener: (...args: unknown[]) => void) => {
				this.on(event, listener);
			},
			/* v8 ignore next -- @preserve */
			emit: (event: string, ...args: unknown[]) => this.emit(event, ...args),
		};

		const wrapOptions = {
			ttl: options?.ttl ?? this._ttl,
			keyPrefix: options?.keyPrefix,
			createKey: options?.createKey,
			cacheErrors: options?.cacheErrors,
			cache: cacheAdapter,
			cacheId: this._cacheId,
			serialize: options?.serialize,
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
		const getOptions =
			options?.nonBlocking === undefined
				? undefined
				: { nonBlocking: options.nonBlocking };
		const cacheAdapter: CacheInstance = {
			get: async (key: string) => this.get(key, getOptions),
			/* v8 ignore next -- @preserve */
			has: async (key: string) => this.has(key),
			set: async (
				key: string,
				value: unknown,
				ttl?: number | string | PerStoreTtl,
			) => {
				await this.set(key, value, { ttl });
			},
			/* v8 ignore next -- @preserve */
			on: (event: string, listener: (...args: unknown[]) => void) => {
				/* v8 ignore next -- @preserve */
				this.on(event, listener);
			},
			emit: (event: string, ...args: unknown[]) => this.emit(event, ...args),
		};

		const getOrSetOptions: GetOrSetOptions = {
			cache: cacheAdapter,
			cacheId: this._cacheId,
			ttl: options?.ttl ?? this._ttl,
			cacheErrors: options?.cacheErrors,
			throwErrors: options?.throwErrors,
			nonBlocking: options?.nonBlocking,
		};
		return getOrSet(key, function_, getOrSetOptions);
	}

	/**
	 * Will hash an object asynchronously using the specified cryptographic algorithm.
	 * Use this for cryptographic algorithms (SHA-256, SHA-384, SHA-512).
	 * For non-cryptographic algorithms, use hashSync() for better performance.
	 * @param {any} object the object to hash
	 * @param {string} algorithm the hash algorithm to use. The default is 'SHA-256'
	 * @returns {Promise<string>} the hash of the object
	 */
	public async hash(
		// biome-ignore lint/suspicious/noExplicitAny: type format
		object: any,
		algorithm: HashAlgorithm = HashAlgorithm.SHA256,
	): Promise<string> {
		return hash(object, { algorithm });
	}

	/**
	 * Will hash an object synchronously using the specified non-cryptographic algorithm.
	 * Use this for non-cryptographic algorithms (DJB2, FNV1, MURMER, CRC32).
	 * For cryptographic algorithms, use hash() instead.
	 * @param {any} object the object to hash
	 * @param {string} algorithm the hash algorithm to use. The default is 'djb2'
	 * @returns {string} the hash of the object
	 */
	public hashSync(
		// biome-ignore lint/suspicious/noExplicitAny: type format
		object: any,
		algorithm: HashAlgorithm = HashAlgorithm.DJB2,
	): string {
		return hashSync(object, { algorithm });
	}

	private async setManyKeyv(
		keyv: Keyv,
		items: CacheableSetItem[],
		store: "primary" | "secondary",
	): Promise<boolean> {
		const maxTtlMs = shorthandToMilliseconds(this._maxTtl);
		const entries: KeyvEntry[] = [];
		for (const item of items) {
			const finalTtl = this.resolveStoreTtl(
				item.ttl,
				keyv.ttl,
				store,
				maxTtlMs,
			);
			entries.push({ key: item.key, value: item.value, ttl: finalTtl });
		}

		await keyv.setMany(entries);

		return true;
	}

	/**
	 * Writes tag snapshots for `setMany` items that carry tags and removes any previous snapshots
	 * for items that do not.
	 */
	private async setManyKeyTags(items: CacheableSetItem[]): Promise<void> {
		const maxTtlMs = shorthandToMilliseconds(this._maxTtl);
		const promises = [];
		const untaggedKeys: string[] = [];
		for (const item of items) {
			if (!item.tags || item.tags.length === 0) {
				untaggedKeys.push(item.key);
				continue;
			}

			// The tag snapshot must outlive the longest-lived copy of the value across the stores,
			// so it uses the maximum of each store's resolved ttl (matching `set`). Per-store ttl
			// objects are honored independently.
			const primaryTtl = this.resolveStoreTtl(
				item.ttl,
				this._primary.ttl,
				"primary",
				maxTtlMs,
			);
			const secondaryTtl = this._secondary
				? this.resolveStoreTtl(
						item.ttl,
						this._secondary.ttl,
						"secondary",
						maxTtlMs,
					)
				: undefined;
			const ttl = this.maxStoreTtl(primaryTtl, secondaryTtl);

			promises.push(
				this._tags.setKeyTags(item.key, item.tags, {
					ttl,
					nonBlocking: this._nonBlocking,
				}),
			);
		}

		if (untaggedKeys.length > 0) {
			promises.push(
				this._tags.removeKeys(untaggedKeys, {
					nonBlocking: this._nonBlocking,
				}),
			);
		}

		await Promise.all(promises);
	}

	/**
	 * Processes a single key from secondary store for getRaw operation
	 * @param primary - the primary store to use
	 * @param secondary - the secondary store to use
	 * @param key - The key to retrieve from secondary store
	 * @returns Promise containing the result and TTL information
	 */
	private async processSecondaryForGetRaw<T>(
		primary: Keyv,
		secondary: Keyv,
		key: string,
	): Promise<
		| {
				result: StoredDataRaw<T>;
				ttl?: number | string;
		  }
		| undefined
	> {
		const secondaryResult = await secondary.getRaw<T>(key);
		if (secondaryResult?.value) {
			// Emit cache hit for secondary store
			this.emit(CacheableEvents.CACHE_HIT, {
				key,
				value: secondaryResult.value,
				store: "secondary",
			});
			const cascadeTtl = getCascadingTtl(this._ttl, this._primary.ttl);
			const expires = secondaryResult.expires ?? undefined;
			const ttl = calculateTtlFromExpiration(cascadeTtl, expires);
			const setItem = { key, value: secondaryResult.value, ttl };
			await this.hook(CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY, setItem);
			await primary.set(
				setItem.key,
				setItem.value,
				resolvePerStoreTtl(setItem.ttl).primary,
			);

			return { result: secondaryResult, ttl };
		} else {
			// Emit cache miss for secondary store
			this.emit(CacheableEvents.CACHE_MISS, { key, store: "secondary" });
			return undefined;
		}
	}

	/**
	 * Processes a single key from secondary store for getRaw operation in non-blocking mode
	 * Non-blocking mode means we don't wait for secondary operations that update primary store
	 * @param primary - the primary store to use
	 * @param secondary - the secondary store to use
	 * @param key - The key to retrieve from secondary store
	 * @returns Promise containing the result and TTL information
	 */
	private async processSecondaryForGetRawNonBlocking<T>(
		primary: Keyv,
		secondary: Keyv,
		key: string,
	): Promise<
		| {
				result: StoredDataRaw<T>;
				ttl?: number | string;
		  }
		| undefined
	> {
		const secondaryResult = await secondary.getRaw<T>(key);
		if (secondaryResult?.value) {
			// Emit cache hit for secondary store
			this.emit(CacheableEvents.CACHE_HIT, {
				key,
				value: secondaryResult.value,
				store: "secondary",
			});
			const cascadeTtl = getCascadingTtl(this._ttl, this._primary.ttl);
			const expires = secondaryResult.expires ?? undefined;
			const ttl = calculateTtlFromExpiration(cascadeTtl, expires);
			const setItem = { key, value: secondaryResult.value, ttl };

			// In non-blocking mode, fire and forget the hook and primary store update
			/* v8 ignore next -- @preserve */
			this.hook(CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY, setItem)
				.then(async () => {
					await primary.set(
						setItem.key,
						setItem.value,
						resolvePerStoreTtl(setItem.ttl).primary,
					);
				})
				/* v8 ignore next -- @preserve */
				.catch((error) => {
					/* v8 ignore next -- @preserve */
					this.emit(CacheableEvents.ERROR, error);
				});

			return { result: secondaryResult, ttl };
		} else {
			// Emit cache miss for secondary store
			this.emit(CacheableEvents.CACHE_MISS, { key, store: "secondary" });
			return undefined;
		}
	}

	/**
	 * Processes missing keys from secondary store for getManyRaw operation
	 * @param primary - the primary store to use
	 * @param secondary - the secondary store to use
	 * @param keys - The original array of keys requested
	 * @param result - The result array from primary store (will be modified)
	 * @returns Promise<void>
	 */
	private async processSecondaryForGetManyRaw<T>(
		primary: Keyv,
		secondary: Keyv,
		keys: string[],
		result: Array<StoredDataRaw<T>>,
	): Promise<void> {
		const missingKeys = [];
		for (const [i, key] of keys.entries()) {
			if (!result[i]) {
				missingKeys.push(key);
			}
		}

		const secondaryResults = await secondary.getManyRaw<T>(missingKeys);

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

					/* v8 ignore next -- @preserve */
					if (expires === null) {
						expires = undefined;
					}

					const ttl = calculateTtlFromExpiration(cascadeTtl, expires);

					const setItem = { key, value: secondaryResult.value, ttl };

					await this.hook(
						CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY,
						setItem,
					);
					await primary.set(
						setItem.key,
						setItem.value,
						resolvePerStoreTtl(setItem.ttl).primary,
					);
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

	/**
	 * Processes missing keys from secondary store for getManyRaw operation in non-blocking mode
	 * Non-blocking mode means we don't wait for secondary operations that update primary store
	 * @param secondary - the secondary store to use
	 * @param keys - The original array of keys requested
	 * @param result - The result array from primary store (will be modified)
	 * @returns Promise<void>
	 */
	private async processSecondaryForGetManyRawNonBlocking<T>(
		primary: Keyv,
		secondary: Keyv,
		keys: string[],
		result: Array<StoredDataRaw<T>>,
	): Promise<void> {
		const missingKeys = [];
		for (const [i, key] of keys.entries()) {
			if (!result[i]) {
				missingKeys.push(key);
			}
		}

		// Get secondary results synchronously but don't wait for primary store updates
		const secondaryResults = await secondary.getManyRaw<T>(missingKeys);

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

					/* v8 ignore next -- @preserve */
					if (expires === null) {
						expires = undefined;
					}

					const ttl = calculateTtlFromExpiration(cascadeTtl, expires);

					const setItem = { key, value: secondaryResult.value, ttl };

					// In non-blocking mode, fire and forget the hook and primary store update
					/* v8 ignore next -- @preserve */
					this.hook(CacheableHooks.BEFORE_SECONDARY_SETS_PRIMARY, setItem)
						.then(async () => {
							await primary.set(
								setItem.key,
								setItem.value,
								resolvePerStoreTtl(setItem.ttl).primary,
							);
						})
						/* v8 ignore next -- @preserve */
						.catch((error) => {
							/* v8 ignore next -- @preserve */
							this.emit(CacheableEvents.ERROR, error);
						});
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

	private setTtl(ttl: number | string | undefined): void {
		if (typeof ttl === "string" || ttl === undefined) {
			this._ttl = ttl;
		} else if (ttl > 0) {
			this._ttl = ttl;
		} else {
			this._ttl = undefined;
		}
	}

	private setMaxTtl(maxTtl: number | string | undefined): void {
		if (typeof maxTtl === "string" || maxTtl === undefined) {
			this._maxTtl = maxTtl;
		} else if (maxTtl > 0) {
			this._maxTtl = maxTtl;
		} else {
			this._maxTtl = undefined;
		}
	}

	private capTtl(
		ttl: number | undefined,
		maxTtlMs: number | undefined,
	): number | undefined {
		// A negative or NaN ttl is invalid; treat it as "no ttl" (parity with the instance-level
		// guards in setTtl/setMaxTtl). A ttl of 0 is preserved because it means the entry never
		// expires.
		if (ttl !== undefined && (Number.isNaN(ttl) || ttl < 0)) {
			ttl = undefined;
		}

		if (maxTtlMs === undefined) {
			return ttl;
		}

		if (ttl === undefined) {
			return maxTtlMs;
		}

		return Math.min(ttl, maxTtlMs);
	}

	/**
	 * Resolves the ttl for a tag snapshot so it outlives the longest-lived copy of the value across
	 * the stores. With a secondary store the snapshot uses the larger of the two ttls and never
	 * expires if either copy never expires; with only a primary store it tracks the primary ttl.
	 * @param primaryTtl - the resolved primary store ttl in milliseconds, or undefined for no expiry
	 * @param secondaryTtl - the resolved secondary store ttl in milliseconds, or undefined for no expiry
	 * @returns {number | undefined} The tag snapshot ttl in milliseconds, or undefined for no expiry
	 */
	private maxStoreTtl(
		primaryTtl: number | undefined,
		secondaryTtl: number | undefined,
	): number | undefined {
		if (!this._secondary) {
			return primaryTtl;
		}

		// A ttl of 0 or undefined means that store's copy never expires, so the snapshot must be
		// immortal too; otherwise it could lapse while an immortal copy is still cached and a later
		// invalidation could no longer reach it.
		if (!primaryTtl || !secondaryTtl) {
			return undefined;
		}

		return Math.max(primaryTtl, secondaryTtl);
	}

	/**
	 * Resolves the effective ttl actually written to one store for a `setMany` item: the per-store
	 * explicit value (a scalar applies to both stores; a `{ primary, secondary }` object is honored
	 * per field) cascaded with the store default and instance ttl, then capped by maxTtl.
	 * @param itemTtl - the item's ttl (number, shorthand string, or per-store object)
	 * @param storeTtl - the target store's default ttl in milliseconds
	 * @param store - which store's field to resolve from a per-store object
	 * @param maxTtlMs - the resolved maxTtl in milliseconds, or undefined for no cap
	 * @returns {number | undefined} The effective ttl in milliseconds, or undefined for no expiry
	 */
	private resolveStoreTtl(
		itemTtl: number | string | PerStoreTtl | undefined,
		storeTtl: number | undefined,
		store: "primary" | "secondary",
		maxTtlMs: number | undefined,
	): number | undefined {
		const explicitTtl = resolvePerStoreTtl(itemTtl)[store];
		return this.capTtl(
			getCascadingTtl(this._ttl, storeTtl, explicitTtl),
			maxTtlMs,
		);
	}
}

export {
	CacheableMemory,
	type CacheableMemoryOptions,
	createKeyv,
	KeyvCacheableMemory,
	type KeyvCacheableMemoryOptions,
} from "@cacheable/memory";
export {
	type CacheableItem,
	CacheTags,
	type CacheTagsOptions,
	calculateTtlFromExpiration,
	type GetOrSetKey,
	type GetOrSetOptions,
	getCascadingTtl,
	getOrSet,
	HashAlgorithm,
	hash,
	type KeyTagEntry,
	type SetKeyTagsOptions,
	Stats as CacheableStats,
	shorthandToMilliseconds,
	shorthandToTime,
	type WrapOptions,
	type WrapSyncOptions,
	wrap,
	wrapSync,
} from "@cacheable/utils";
export { Keyv, KeyvHooks, type KeyvOptions, type KeyvStoreAdapter } from "keyv";
export { CacheableEvents, CacheableHooks } from "./enums.js";
export {
	CacheableSync,
	CacheableSyncEvents,
	type CacheableSyncItem,
	type CacheableSyncOptions,
} from "./sync.js";
export type {
	CacheableAfterGetItem,
	CacheableAfterGetManyItem,
	CacheableHookItem,
	CacheableOptions,
	CacheableSecondarySetsPrimaryItem,
	CacheableSetItem,
	GetOptions,
	GetOrSetFunctionOptions,
	PerStoreTtl,
	SetOptions,
	WrapFunctionOptions,
} from "./types.js";
