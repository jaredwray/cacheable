import type {
	CacheableItem,
	PerStoreTtl,
	GetOrSetFunctionOptions as UtilsGetOrSetFunctionOptions,
	WrapFunctionOptions as UtilsWrapFunctionOptions,
} from "@cacheable/utils";
import type { Keyv, KeyvStoreAdapter, StoredDataRaw } from "keyv";
import type { CacheableSync, CacheableSyncOptions } from "./sync.js";

export type { PerStoreTtl } from "@cacheable/utils";

/**
 * Options for {@link Cacheable.getOrSet}. Identical to the shared
 * `GetOrSetFunctionOptions` from `@cacheable/utils`, except `ttl` also accepts a per-store object
 * (`{ primary, secondary }`) so the primary and secondary stores can be given different
 * expirations for that operation.
 */
export type GetOrSetFunctionOptions = Omit<
	UtilsGetOrSetFunctionOptions,
	"ttl"
> & {
	ttl?: number | string | PerStoreTtl;
};

/**
 * Options for {@link Cacheable.wrap}. Identical to the shared `WrapFunctionOptions` from
 * `@cacheable/utils`, except `ttl` also accepts a per-store object (`{ primary, secondary }`) so the
 * primary and secondary stores can be given different expirations for the wrapped value.
 */
export type WrapFunctionOptions = Omit<UtilsWrapFunctionOptions, "ttl"> & {
	ttl?: number | string | PerStoreTtl;
};

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
	 * The maximum time-to-live for the cacheable instance. When set, any TTL that exceeds this value
	 * is capped to maxTtl. Entries with no TTL will also be capped to maxTtl.
	 * Can be a number in milliseconds or a human-readable format such as `1s`, `1m`, `1h`, `1d`.
	 * Default is `undefined` (no maximum).
	 */
	maxTtl?: number | string;
	/**
	 * The namespace for the cacheable instance. It can be a string or a function that returns a string.
	 */
	namespace?: string | (() => string);
	/**
	 * The cacheId for the cacheable instance. This is primarily used for the wrap function to not have conflicts.
	 * If it is not set then it will be a random string that is generated
	 */
	cacheId?: string;
	/**
	 * The sync instance for the cacheable instance to enable synchronization across cache instances
	 */
	sync?: CacheableSync | CacheableSyncOptions;
	/**
	 * Enables the tag service so tag-based invalidation can be used and freshness checks run on
	 * every `get` / `getMany`. Tags must be explicitly enabled — while disabled, all tag
	 * operations are no-ops and values set with `tags` are stored without tag tracking. Enable
	 * this on every instance that shares the store (writers and readers) so invalidations are
	 * honored consistently across distributed instances. Default is `false`.
	 */
	tags?: boolean;
};

export type GetOptions = {
	/**
	 * If set, this will bypass the instances nonBlocking setting.
	 * @type {boolean}
	 */
	nonBlocking?: boolean;
};

export type SetOptions = {
	/**
	 * If set, this will bypass the instances nonBlocking setting.
	 * @type {boolean}
	 */
	nonBlocking?: boolean;
	/**
	 * Time-to-live. If you set a number it is milliseconds, if you set a string it is a
	 * human-readable format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means
	 * that it will use the default time-to-live.
	 *
	 * You can also pass a per-store object to give each store its own TTL for this operation, such
	 * as `{ primary: '10s', secondary: '5m' }`. Any field left undefined falls back to that store's
	 * own default TTL resolution. This is useful for multi-layer caches where the in-memory primary
	 * and a distributed secondary should expire at different rates.
	 * @type {number | string | PerStoreTtl}
	 */
	ttl?: number | string | PerStoreTtl;
	/**
	 * Tags to associate with the entry for tag-based invalidation. Invalidating any of these tags
	 * via `invalidateTag` / `invalidateTags` makes the entry stale, causing the next `get` to treat
	 * it as a miss and remove it.
	 * @type {string[]}
	 */
	tags?: string[];
};

/**
 * An item for `setMany` that can optionally carry tags for tag-based invalidation.
 */
export type CacheableSetItem = Omit<CacheableItem, "ttl"> & {
	/**
	 * Time-to-live. If you set a number it is milliseconds, if you set a string it is a
	 * human-readable format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means
	 * that it will use the default time-to-live.
	 *
	 * You can also pass a per-store object to give each store its own TTL for this item, such as
	 * `{ primary: '10s', secondary: '5m' }`. Any field left undefined falls back to that store's own
	 * default TTL resolution.
	 * @type {number | string | PerStoreTtl}
	 */
	ttl?: number | string | PerStoreTtl;
	/**
	 * Tags to associate with the entry for tag-based invalidation. Invalidating any of these tags
	 * via `invalidateTag` / `invalidateTags` makes the entry stale, causing the next `get` to treat
	 * it as a miss and remove it.
	 * @type {string[]}
	 */
	tags?: string[];
};

/**
 * The mutable item passed to the `BEFORE_SET` and `AFTER_SET` hooks. Within a `BEFORE_SET` handler
 * you may reassign `ttl` to give the entry a new expiration — either a single value (a number in
 * milliseconds or a shorthand string, applied to every store) or a per-store object
 * (`{ primary, secondary }`) so the primary and secondary stores expire at different rates. Any
 * assignment counts as an override (even assigning the value it already holds); a field omitted from
 * a per-store object falls back to that store's normal TTL resolution.
 *
 * By the time `AFTER_SET` runs, `ttl` has been normalized to the effective **primary** TTL as a
 * number (the value written to the primary store, after `maxTtl` capping); the secondary store's
 * effective TTL is not exposed on the item.
 */
export type CacheableHookItem<T = unknown> = {
	key: string;
	value: T;
	ttl?: number | string | PerStoreTtl;
	tags?: string[];
};

/**
 * The item passed to the `AFTER_GET` hook after a `get` / `getRaw`.
 */
export type CacheableAfterGetItem = {
	key: string;
	result?: StoredDataRaw<unknown>;
	ttl?: number | string;
};

/**
 * The item passed to the `AFTER_GET_MANY` hook after a `getMany` / `getManyRaw`.
 */
export type CacheableAfterGetManyItem = {
	keys: string[];
	result: Array<StoredDataRaw<unknown>>;
};

/**
 * The item passed to the `BEFORE_SECONDARY_SETS_PRIMARY` hook. This hook only writes the primary
 * store, so its `ttl` is a single value (a number in milliseconds or a shorthand string), not a
 * per-store object.
 */
export type CacheableSecondarySetsPrimaryItem<T = unknown> = {
	key: string;
	value: T;
	ttl?: number | string;
};

export type TakeOptions = {
	/**
	 * If set, this will bypass the instances nonBlocking setting.
	 * @type {boolean}
	 */
	nonBlocking?: boolean;
};

export type HasOptions = {
	/**
	 * If set, this will bypass the instances nonBlocking setting.
	 * @type {boolean}
	 */
	nonBlocking?: boolean;
};

export type DeleteOptions = {
	/**
	 * If set, this will bypass the instances nonBlocking setting.
	 * @type {boolean}
	 */
	nonBlocking?: boolean;
};
