import {type Cacheable, type CacheableMemory} from './index.js';

export type WrapOptions = {
	ttl?: number | string;
	key: string;
	cache: Cacheable;
};

export type WrapSyncOptions = {
	ttl?: number | string;
	key: string;
	cache: CacheableMemory;
};

export type WrapFunctionOptions = {
	ttl?: number | string;
	key: string;
};

export type AnyFunction = (...arguments_: any[]) => any;

export function wrapSync<T>(function_: AnyFunction, options: WrapSyncOptions): AnyFunction {
	const {ttl, key, cache} = options;

	return function (...arguments_: any[]) {
		const cacheKey = wrapKey(function_, key);

		let value = cache.get(cacheKey);

		if (value === undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			value = function_(...arguments_) as T;

			cache.set(cacheKey, value, ttl);
		}

		return value;
	};
}

export function wrap<T>(function_: AnyFunction, options: WrapOptions): AnyFunction {
	const {ttl, key, cache} = options;

	return async function (...arguments_: any[]) {
		const cacheKey = wrapKey(function_, key);

		let value = await cache.get(cacheKey) as T | undefined;

		if (value === undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			value = await function_(...arguments_) as T;

			await cache.set(cacheKey, value, ttl);
		}

		return value;
	};
}

export function wrapKey(function_: AnyFunction, key: string): string {
	return `${key}::${function_.name}`;
}
