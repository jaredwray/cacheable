import {LRUCache} from 'lru-cache';
import cloneDeep from 'lodash.clonedeep';
import {type Config, type Cache, type Store} from '../caching.ts';

function clone<T>(object: T): T {
	if (typeof object === 'object' && object !== null) {
		return cloneDeep(object);
	}

	return object;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
type LRU = LRUCache<string, any>;

type Pre = LRUCache.OptionsTTLLimit<string, any, unknown>;
type Options = Omit<Pre, 'ttlAutopurge'> & Partial<Pick<Pre, 'ttlAutopurge'>>;
export type MemoryConfig = {
	max?: number;
	sizeCalculation?: (value: unknown, key: string) => number;
	shouldCloneBeforeSet?: boolean;
} & Options &
Config;

export type MemoryStore = Store & {
	dump: LRU['dump'];
	load: LRU['load'];
	calculatedSize: LRU['calculatedSize'];
	get size(): number;
};
export type MemoryCache = Cache<MemoryStore>;

/**
 * Wrapper for lru-cache.
 */
export function memoryStore(arguments_?: MemoryConfig): MemoryStore {
	const shouldCloneBeforeSet = arguments_?.shouldCloneBeforeSet !== false; // Clone by default
	const isCacheable = arguments_?.isCacheable ?? (value => value !== undefined);

	const lruOptions = {
		ttlAutopurge: true,
		...arguments_,
		max: arguments_?.max ?? 500,
		ttl: arguments_?.ttl === undefined ? 0 : arguments_.ttl,
	};

	const lruCache = new LRUCache(lruOptions);

	return {
		async del(key) {
			lruCache.delete(key);
		},
		get: async <T>(key: string) => lruCache.get(key) as T,
		keys: async () => [...lruCache.keys()],
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		mget: async (...arguments_) => arguments_.map(x => lruCache.get(x)),
		async mset(arguments_, ttl?) {
			const opt = {ttl: ttl ?? lruOptions.ttl} as const;
			for (const [key, value] of arguments_) {
				if (!isCacheable(value)) {
					throw new Error(`no cacheable value ${JSON.stringify(value)}`);
				}

				if (shouldCloneBeforeSet) {
					lruCache.set(key, clone(value), opt);
				} else {
					lruCache.set(key, value, opt);
				}
			}
		},
		async mdel(...arguments_) {
			for (const key of arguments_) {
				lruCache.delete(key);
			}
		},
		async reset() {
			lruCache.clear();
		},
		ttl: async key => lruCache.getRemainingTTL(key),
		async set(key, value, opt) {
			if (!isCacheable(value)) {
				throw new Error(`no cacheable value ${JSON.stringify(value)}`);
			}

			if (shouldCloneBeforeSet) {
				value = clone(value);
			}

			const ttl = opt ?? lruOptions.ttl;

			lruCache.set(key, value, {ttl});
		},
		get calculatedSize() {
			return lruCache.calculatedSize;
		},
		/**
     * This method is not available in the caching modules.
     */
		get size() {
			return lruCache.size;
		},
		/**
     * This method is not available in the caching modules.
     */
		dump: () => lruCache.dump(),
		/**
     * This method is not available in the caching modules.
     */
		load(...arguments_: Parameters<LRU['load']>) {
			lruCache.load(...arguments_);
		},
	};
}
