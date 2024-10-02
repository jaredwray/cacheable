import {type Cacheable, type CacheableMemory} from './index.js';

export type WrapOptions = {
	ttl?: number;
	key?: string;
	cache: Cacheable;
	memoryCache: CacheableMemory;
};

export type AnyFunction = (...arguments_: any[]) => any;

export function wrap<T>(function_: AnyFunction, options: WrapOptions): AnyFunction {
	const {ttl, key, cache, memoryCache} = options;

	if (function_.constructor.name === 'AsyncFunction') {
		return async function (...arguments_: any[]) {
			const cacheKey = key ?? cache.hash(arguments_);

			let value = await cache.get(cacheKey) as T | undefined;

			if (value === undefined) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				value = await function_(...arguments_) as T;

				await cache.set(cacheKey, value, ttl);
			}

			return value;
		};
	}

	return function (...arguments_: any[]) {
		const cacheKey = key ?? cache.hash(arguments_);

		let value = memoryCache.get(cacheKey) as T | undefined;

		if (value === undefined) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			value = function_(...arguments_) as T;

			memoryCache.set(cacheKey, value, ttl);
		}

		return value;
	};
}
