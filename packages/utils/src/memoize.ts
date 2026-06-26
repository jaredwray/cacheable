import { coalesceAsync } from "./coalesce-async.js";
import { hashSync } from "./hash.js";
import type { PerStoreTtl } from "./ttl.js";

export type CacheInstance = {
	// biome-ignore lint/suspicious/noExplicitAny: type format
	get: (key: string) => Promise<any | undefined>;
	has: (key: string) => Promise<boolean>;
	set: (
		key: string,
		// biome-ignore lint/suspicious/noExplicitAny: type format
		value: any,
		ttl?: number | string | PerStoreTtl,
	) => Promise<void>;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	on: (event: string, listener: (...args: any[]) => void) => void;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	emit: (event: string, ...args: any[]) => boolean;
};

export type CacheSyncInstance = {
	// biome-ignore lint/suspicious/noExplicitAny: type format
	get: (key: string) => any | undefined;
	has: (key: string) => boolean;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	set: (key: string, value: any, ttl?: number | string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	on: (event: string, listener: (...args: any[]) => void) => void;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	emit: (event: string, ...args: any[]) => boolean;
};

export type GetOrSetKey = string | ((options?: GetOrSetOptions) => string);

type GetOrSetThrowErrorsContext = "function" | "store";

export type GetOrSetFunctionOptions = {
	ttl?: number | string;
	cacheErrors?: boolean;
	/** Whether or not to throw errors:
	 * - `false` (default) - do not throw any errors
	 * - `true` - throw any error
	 * - `"function"` - only throw errors that occur in the provided function / setter
	 * - `"store"` - only throw errors that occur when getting/setting the cache
	 */
	throwErrors?: boolean | GetOrSetThrowErrorsContext;
	/**
	 * If set, this will bypass the instances nonBlocking setting for the get call.
	 * @type {boolean}
	 */
	nonBlocking?: boolean;
};

export type GetOrSetOptions = Omit<GetOrSetFunctionOptions, "ttl"> & {
	// The cache adapter may interpret a per-store TTL object (e.g. Cacheable's primary/secondary
	// stores); single-store callers continue to use a number or shorthand string.
	ttl?: number | string | PerStoreTtl;
	cacheId?: string;
	cache: CacheInstance;
};

/**
 * Options for {@link getOrSetSync}, the synchronous counterpart to {@link GetOrSetOptions}. It
 * targets a {@link CacheSyncInstance} and its `ttl` is always a single value (a number in
 * milliseconds or a shorthand string), never a per-store object. The inherited `nonBlocking`
 * option has no effect on a single, synchronous store.
 */
export type GetOrSetSyncOptions = GetOrSetFunctionOptions & {
	cache: CacheSyncInstance;
};

/**
 * A cache key for {@link getOrSetSync}: either a string or a function that derives the key from the
 * resolved {@link GetOrSetSyncOptions}.
 */
export type GetOrSetSyncKey =
	| string
	| ((options?: GetOrSetSyncOptions) => string);

export type CreateWrapKey = (
	function_: AnyFunction,
	// biome-ignore lint/suspicious/noExplicitAny: type format
	arguments_: any[],
	options?: WrapFunctionOptions,
) => string;

export type WrapFunctionOptions = {
	ttl?: number | string;
	keyPrefix?: string;
	createKey?: CreateWrapKey;
	cacheErrors?: boolean;
	cacheId?: string;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	serialize?: (object: any) => string;
};

export type WrapOptions = Omit<WrapFunctionOptions, "ttl"> & {
	// The cache adapter may interpret a per-store TTL object (e.g. Cacheable's primary/secondary
	// stores); single-store callers continue to use a number or shorthand string.
	ttl?: number | string | PerStoreTtl;
	cache: CacheInstance;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	serialize?: (object: any) => string;
};

export type WrapSyncOptions = WrapFunctionOptions & {
	cache: CacheSyncInstance;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	serialize?: (object: any) => string;
};

// biome-ignore lint/suspicious/noExplicitAny: type format
export type AnyFunction = (...arguments_: any[]) => any;

export function wrapSync<T>(
	function_: AnyFunction,
	options: WrapSyncOptions,
): AnyFunction {
	const { ttl, keyPrefix, cache, serialize } = options;

	// biome-ignore lint/suspicious/noExplicitAny: type format
	return (...arguments_: any[]) => {
		let cacheKey = createWrapKey(function_, arguments_, {
			keyPrefix,
			serialize,
		});
		if (options.createKey) {
			cacheKey = options.createKey(function_, arguments_, options);
		}

		let value = cache.get(cacheKey) as T | undefined;

		if (value === undefined) {
			try {
				value = function_(...arguments_) as T;
				cache.set(cacheKey, value, ttl);
			} catch (error) {
				cache.emit("error", error);
				if (options.cacheErrors) {
					cache.set(cacheKey, error, ttl);
				}
			}
		}

		return value as T;
	};
}

export async function getOrSet<T>(
	key: GetOrSetKey,
	function_: () => Promise<T>,
	options: GetOrSetOptions,
): Promise<T | undefined> {
	const keyString = typeof key === "function" ? key(options) : key;

	let value: T | undefined;

	try {
		value = await options.cache.get(keyString);
	} catch (error) {
		options.cache.emit("error", error);
		if (options.throwErrors === true || options.throwErrors === "store") {
			throw error;
		}
	}

	if (value === undefined) {
		const cacheId = options.cacheId ?? "default";
		const coalesceKey = `${cacheId}::${keyString}`;
		value = await coalesceAsync(coalesceKey, async () => {
			let result: T | undefined;
			try {
				// try to do the logic passed in as the setter
				try {
					result = await function_();
				} catch (error) {
					throw new ErrorEnvelope<GetOrSetThrowErrorsContext>(
						error,
						"function",
					);
				}
				// try to write the result to the cache
				try {
					await options.cache.set(keyString, result, options.ttl);
				} catch (error) {
					throw new ErrorEnvelope<GetOrSetThrowErrorsContext>(error, "store");
				}
				return result;
			} catch (caught) {
				const errorType =
					caught instanceof ErrorEnvelope
						? (caught as ErrorEnvelope<GetOrSetThrowErrorsContext>).context
						: /* c8 ignore next 1 */
							undefined;
				const error = caught instanceof ErrorEnvelope ? caught.error : caught;

				options.cache.emit("error", error);
				// Only cache errors that originated in the value function — a failed store write has
				// no error worth caching and the store is already unhealthy. Wrapping the write also
				// keeps a second failure from escaping as an uncaught rejection that bypasses the
				// throwErrors handling below.
				if (options.cacheErrors && errorType === "function") {
					try {
						await options.cache.set(keyString, error, options.ttl);
					} catch (storeError) {
						options.cache.emit("error", storeError);
					}
				}

				if (options.throwErrors === true || options.throwErrors === errorType) {
					throw error;
				}
			}
			return result;
		});
	}

	return value;
}

/**
 * Synchronous counterpart to {@link getOrSet}. Reads `key` from the cache and, on a miss, computes
 * the value with `function_`, stores it, and returns it.
 *
 * Unlike {@link getOrSet} there is no request coalescing: synchronous code runs to completion
 * without interleaving, so concurrent callers cannot stampede the setter the way they can with an
 * async cache.
 *
 * Error handling mirrors {@link getOrSet}: errors are emitted on the cache's `error` event, can be
 * cached when `cacheErrors` is set, and can be rethrown selectively via `throwErrors` (`true` for
 * any error, `"function"` for setter errors, `"store"` for cache read/write errors).
 *
 * @param key - The cache key, or a function that derives it from the resolved options.
 * @param function_ - The setter invoked on a cache miss to compute the value.
 * @param options - The {@link GetOrSetSyncOptions} including the target synchronous cache.
 * @returns The cached or freshly computed value, or `undefined`.
 */
export function getOrSetSync<T>(
	key: GetOrSetSyncKey,
	function_: () => T,
	options: GetOrSetSyncOptions,
): T | undefined {
	const keyString = typeof key === "function" ? key(options) : key;

	let value: T | undefined;

	try {
		value = options.cache.get(keyString) as T | undefined;
	} catch (error) {
		options.cache.emit("error", error);
		if (options.throwErrors === true || options.throwErrors === "store") {
			throw error;
		}
	}

	if (value === undefined) {
		try {
			// try to do the logic passed in as the setter
			try {
				value = function_();
			} catch (error) {
				throw new ErrorEnvelope<GetOrSetThrowErrorsContext>(error, "function");
			}

			// try to write the result to the cache
			try {
				options.cache.set(keyString, value, options.ttl);
			} catch (error) {
				throw new ErrorEnvelope<GetOrSetThrowErrorsContext>(error, "store");
			}
		} catch (caught) {
			const errorType =
				caught instanceof ErrorEnvelope
					? (caught as ErrorEnvelope<GetOrSetThrowErrorsContext>).context
					: /* c8 ignore next 1 */
						undefined;
			const error = caught instanceof ErrorEnvelope ? caught.error : caught;

			options.cache.emit("error", error);
			// Only cache errors that originated in the value function — a failed store write has no
			// error worth caching and the store is already unhealthy. Wrapping the write also keeps a
			// second failure from escaping as an uncaught throw that bypasses the throwErrors handling
			// below.
			if (options.cacheErrors && errorType === "function") {
				try {
					options.cache.set(keyString, error, options.ttl);
				} catch (storeError) {
					options.cache.emit("error", storeError);
				}
			}

			if (options.throwErrors === true || options.throwErrors === errorType) {
				throw error;
			}
		}
	}

	return value;
}

export function wrap<T>(
	function_: AnyFunction,
	options: WrapOptions,
): AnyFunction {
	const { keyPrefix, serialize } = options;

	// biome-ignore lint/suspicious/noExplicitAny: type format
	return async (...arguments_: any[]) => {
		let cacheKey = createWrapKey(function_, arguments_, {
			keyPrefix,
			serialize,
		});
		if (options.createKey) {
			cacheKey = options.createKey(function_, arguments_, options);
		}

		return getOrSet(
			cacheKey,
			async (): Promise<T | undefined> => function_(...arguments_),
			options,
		);
	};
}

export type CreateWrapKeyOptions = {
	keyPrefix?: string;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	serialize?: (object: any) => string;
};

export function createWrapKey(
	function_: AnyFunction,
	// biome-ignore lint/suspicious/noExplicitAny: type format
	arguments_: any[],
	options?: CreateWrapKeyOptions,
): string {
	const { keyPrefix, serialize } = options || {};

	if (!keyPrefix) {
		return `${function_.name}::${hashSync(arguments_, { serialize })}`;
	}

	return `${keyPrefix}::${function_.name}::${hashSync(arguments_, { serialize })}`;
}

class ErrorEnvelope<T> {
	constructor(
		public error: unknown,
		public context: T,
	) {}
}
