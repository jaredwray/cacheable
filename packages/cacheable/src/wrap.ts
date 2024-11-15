import {hash} from './hash.js';
import {coalesceAsync} from './coalesce-async.js';
import {type Cacheable, type CacheableMemory} from './index.js';

export type WrapFunctionOptions = {
	ttl?: number | string;
	keyPrefix?: string;
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
		const cacheKey = createWrapKey(function_, arguments_, keyPrefix);
		let value = cache.get(cacheKey);

		if (value === undefined) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				value = function_(...arguments_);
				cache.set(cacheKey, value, ttl);
			} catch (error) {
				cache.emit('error', error);
			}
		}

		return value as T;
	};
}

export function wrap<T>(function_: AnyFunction, options: WrapOptions): AnyFunction {
	const {ttl, keyPrefix, cache} = options;

	return async function (...arguments_: any[]) {
		let value;

		const cacheKey = createWrapKey(function_, arguments_, keyPrefix);

		value = await cache.get(cacheKey) as T | undefined;

		if (value === undefined) {
			value = await coalesceAsync(cacheKey, async () => {
				try {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					const result = await function_(...arguments_) as T;
					await cache.set(cacheKey, result, ttl);
					return result;
				} catch (error) {
					cache.emit('error', error);
				}
			});
		}

		return value;
	};
}

export function createWrapKey(function_: AnyFunction, arguments_: any[], keyPrefix?: string): string {
	if (!keyPrefix) {
		return `${function_.name}::${hash(arguments_)}`;
	}

	return `${keyPrefix}::${function_.name}::${hash(arguments_)}`;
}
