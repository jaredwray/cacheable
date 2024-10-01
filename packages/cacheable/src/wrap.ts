import { Cacheable, CacheableMemory } from './index.js';

export type WrapOptions = {
	ttl?: number;
  	key?: string;
	cache: Cacheable;
	memoryCache: CacheableMemory;
};

export type AnyFunction = (...args: any[]) => any;

export function wrap(fn: AnyFunction, options: WrapOptions): AnyFunction {
	const { ttl, key, cache, memoryCache } = options;

	if(fn.constructor.name === 'AsyncFunction') {
		return async function (...args: any[]) {
			const cacheKey = key || cache.hash(args);

			let value = await cache.get(cacheKey);

			if (value === undefined) {
				value = await fn(...args);

				await cache.set(cacheKey, value, ttl);
			}

			return value;
		};
	} else {
		return function (...args: any[]) {
			const cacheKey = key || cache.hash(args);

			let value = memoryCache.get(cacheKey);

			if (value === undefined) {
				value = fn(...args);

				memoryCache.set(cacheKey, value, ttl);
			}

			return value;
		};
	}
}
