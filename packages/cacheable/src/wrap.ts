import {hash} from './hash.js';
import {type Cacheable, type CacheableMemory} from './index.js';

export type WrapFunctionOptions = {
	ttl?: number | string;
	keyPrefix?: string;
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
		const cacheKey = createWrapKey(function_, arguments_, keyPrefix);
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

export function wrap<T>(function_: AnyFunction, options: WrapOptions): AnyFunction {
	const {keyPrefix, cache} = options;

	return async function (...arguments_: any[]) {
		const cacheKey = createWrapKey(function_, arguments_, keyPrefix);
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
