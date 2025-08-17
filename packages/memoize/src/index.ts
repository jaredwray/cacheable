import { coalesceAsync, hash } from "@cacheable/utils";

export type CacheInstance = {
	// biome-ignore lint/suspicious/noExplicitAny: type format
	get: (key: string) => Promise<any | undefined>;
	has: (key: string) => Promise<boolean>;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	set: (key: string, value: any, ttl?: number | string) => Promise<void>;
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

export type GetOrSetFunctionOptions = {
	ttl?: number | string;
	cacheErrors?: boolean;
	throwErrors?: boolean;
};

export type GetOrSetOptions = GetOrSetFunctionOptions & {
	cacheId?: string;
	cache: CacheInstance;
};

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
};

export type WrapOptions = WrapFunctionOptions & {
	cache: CacheInstance;
};

export type WrapSyncOptions = WrapFunctionOptions & {
	cache: CacheSyncInstance;
};

// biome-ignore lint/suspicious/noExplicitAny: type format
export type AnyFunction = (...arguments_: any[]) => any;

export function wrapSync<T>(
	function_: AnyFunction,
	options: WrapSyncOptions,
): AnyFunction {
	const { ttl, keyPrefix, cache } = options;

	// biome-ignore lint/suspicious/noExplicitAny: type format
	return (...arguments_: any[]) => {
		let cacheKey = createWrapKey(function_, arguments_, keyPrefix);
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

	let value = (await options.cache.get(keyString)) as T | undefined;

	if (value === undefined) {
		const cacheId = options.cacheId ?? "default";
		const coalesceKey = `${cacheId}::${keyString}`;
		value = await coalesceAsync(coalesceKey, async () => {
			try {
				const result = (await function_()) as T;
				await options.cache.set(keyString, result, options.ttl);
				return result;
			} catch (error) {
				options.cache.emit("error", error);
				if (options.cacheErrors) {
					await options.cache.set(keyString, error, options.ttl);
				}

				if (options.throwErrors) {
					throw error;
				}
			}
		});
	}

	return value;
}

export function wrap<T>(
	function_: AnyFunction,
	options: WrapOptions,
): AnyFunction {
	// biome-ignore lint/correctness/noUnusedVariables: allowed
	const { keyPrefix, cache } = options;

	// biome-ignore lint/suspicious/noExplicitAny: type format
	return async (...arguments_: any[]) => {
		let cacheKey = createWrapKey(function_, arguments_, keyPrefix);
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

export function createWrapKey(
	function_: AnyFunction,
	// biome-ignore lint/suspicious/noExplicitAny: type format
	arguments_: any[],
	keyPrefix?: string,
): string {
	if (!keyPrefix) {
		return `${function_.name}::${hash(arguments_)}`;
	}

	return `${keyPrefix}::${function_.name}::${hash(arguments_)}`;
}
