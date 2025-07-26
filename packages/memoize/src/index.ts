import {hash, coalesceAsync} from '@cacheable/utils';
import type {Cacheable, CacheableMemory} from 'cacheable';

export type GetOrSetKey = string | ((options?: GetOrSetOptions) => string);

export type GetOrSetFunctionOptions = {
	ttl?: number | string;
	cacheErrors?: boolean;
	throwErrors?: boolean;
};

export type GetOrSetOptions = GetOrSetFunctionOptions & {
	cacheId?: string;
	cache: Cacheable;
};

export type CreateWrapKey = (function_: AnyFunction, arguments_: any[], options?: WrapFunctionOptions) => string;

export type WrapFunctionOptions = {
	ttl?: number | string;
	keyPrefix?: string;
	createKey?: CreateWrapKey;
	cacheErrors?: boolean;
	cacheId?: string;
};

export type WrapOptions = WrapFunctionOptions & {
	cache: Cacheable;
};

export type WrapSyncOptions = WrapFunctionOptions & {
	cache: CacheableMemory;
};

export type AnyFunction = (...arguments_: any[]) => any;

export function wrapSync<T>(function_: AnyFunction, options: WrapSyncOptions): AnyFunction {
	const {ttl, keyPrefix, cache} = options;

	return function (...arguments_: any[]) {
		let cacheKey = createWrapKey(function_, arguments_, keyPrefix);
		if (options.createKey) {
			cacheKey = options.createKey(function_, arguments_, options);
		}

		let value = cache.get(cacheKey);

		if (value === undefined) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				value = function_(...arguments_);
				cache.set(cacheKey, value, ttl);
			} catch (error) {
				cache.emit('error', error);
				if (options.cacheErrors) {
					cache.set(cacheKey, error, ttl);
				}
			}
		}

		return value as T;
	};
}

export async function getOrSet<T>(key: GetOrSetKey, function_: () => Promise<T>, options: GetOrSetOptions): Promise<T | undefined> {
	const keyString = typeof key === 'function' ? key(options) : key;

	let value = await options.cache.get(keyString) as T | undefined;

	if (value === undefined) {
		const cacheId = options.cacheId ?? 'default';
		const coalesceKey = `${cacheId}::${keyString}`;
		value = await coalesceAsync(coalesceKey, async () => {
			try {
				const result = await function_() as T;
				await options.cache.set(keyString, result, options.ttl);
				return result;
			} catch (error) {
				options.cache.emit('error', error);
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

export function wrap<T>(function_: AnyFunction, options: WrapOptions): AnyFunction {
	const {keyPrefix, cache} = options;

	return async function (...arguments_: any[]) {
		let cacheKey = createWrapKey(function_, arguments_, keyPrefix);
		if (options.createKey) {
			cacheKey = options.createKey(function_, arguments_, options);
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return
		return cache.getOrSet(cacheKey, async (): Promise<T | undefined> => function_(...arguments_), options);
	};
}

export function createWrapKey(function_: AnyFunction, arguments_: any[], keyPrefix?: string): string {
	if (!keyPrefix) {
		return `${function_.name}::${hash(arguments_)}`;
	}

	return `${keyPrefix}::${function_.name}::${hash(arguments_)}`;
}
