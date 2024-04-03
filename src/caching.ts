import {coalesceAsync} from 'promise-coalesce';
import {
	type MemoryCache, type MemoryConfig, type MemoryStore, memoryStore,
} from './stores/index.js';
import EventEmitter from 'eventemitter3';

export type Config = {
	ttl?: Milliseconds;
	refreshThreshold?: Milliseconds;
	isCacheable?: (value: unknown) => boolean;
	onBackgroundRefreshError?: (error: unknown) => void;
  onCacheError?: (error: unknown) => void;
};

export type Milliseconds = number;
/**
 * @deprecated will remove after 5.2.0. Use Milliseconds instead
 */
export type Ttl = Milliseconds;

export type Store = {
	get<T>(key: string): Promise<T | undefined>;
	set<T>(key: string, data: T, ttl?: Milliseconds): Promise<void>;
	del(key: string): Promise<void>;
	reset(): Promise<void>;
	mset(arguments_: Array<[string, unknown]>, ttl?: Milliseconds): Promise<void>;
	mget(...arguments_: string[]): Promise<unknown[]>;
	mdel(...arguments_: string[]): Promise<void>;
	keys(pattern?: string): Promise<string[]>;
	ttl(key: string): Promise<number>;
};

export type StoreConfig = Config;

export type FactoryConfig<T> = T & Config;
export type FactoryStore<S extends Store, T extends Record<string, unknown> = never> = (
	config?: FactoryConfig<T>,
) => S | Promise<S>;

export type Stores<S extends Store, T extends Record<string, unknown>> =
  | 'memory'
  | Store
  | FactoryStore<S, T>;
export type CachingConfig<T> = MemoryConfig | StoreConfig | FactoryConfig<T>;
// eslint-disable-next-line @typescript-eslint/naming-convention
export type WrapTTL<T> = Milliseconds | ((v: T) => Milliseconds);
export type Cache<S extends Store = Store> = {
	store: S;
	set: (key: string, value: unknown, ttl?: Milliseconds) => Promise<void>;
	get: <T>(key: string) => Promise<T | undefined>;
	del: (key: string) => Promise<void>;
	reset: () => Promise<void>;
	on: (event: 'error', handler: (e: Error) => void) => void;
  wrap<T>(
    key: string,
    function_: () => Promise<T>,
    ttl?: WrapTTL<T>,
    refreshThreshold?: Milliseconds,
  ): Promise<T>;

};

export async function caching(
	name: 'memory',
	arguments_?: MemoryConfig,
): Promise<MemoryCache>;
export async function caching<S extends Store>(store: S): Promise<Cache<S>>;
export async function caching<S extends Store, T extends Record<string, unknown> = never>(
	factory: FactoryStore<S, T>,
	arguments_?: FactoryConfig<T>,
): Promise<Cache<S>>;

/**
 * Generic caching interface that wraps any caching library with a compatible interface.
 */
export async function caching<S extends Store, T extends Record<string, unknown> = never>(
	factory: Stores<S, T>,
	arguments_?: CachingConfig<T>,
): Promise<Cache<S> | Cache | MemoryCache> {
	if (factory === 'memory') {
		const store = memoryStore(arguments_ as MemoryConfig);
		return createCache(store, arguments_ as MemoryConfig);
	}

	if (typeof factory === 'function') {
		const store = await factory(arguments_ as FactoryConfig<T>);
		return createCache(store, arguments_);
	}

	return createCache(factory, arguments_);
}

export function createCache(
	store: MemoryStore,
	arguments_?: MemoryConfig,
): MemoryCache;

export function createCache(store: Store, arguments_?: Config): Cache;

/**
 * Create cache instance by store (non-async).
 */
export function createCache<S extends Store, C extends Config>(
	store: S,
	arguments_?: C,
): Cache<S> {
  const eventEmitter = new EventEmitter();

	return {
		/**
     * Wraps a function in cache. I.e., the first time the function is run,
     * its results are stored in cache so subsequent calls retrieve from cache
     * instead of calling the function.

     * @example
     * const result = await cache.wrap('key', () => Promise.resolve(1));
     *
     */
		async wrap<T>(key: string, function_: () => Promise<T>, ttl?: WrapTTL<T>, refreshThreshold?: Milliseconds) {
			const refreshThresholdConfig = refreshThreshold ?? arguments_?.refreshThreshold ?? 0;
			return coalesceAsync(key, async () => {
				const value = await store.get<T>(key).catch((error) => {
				  eventEmitter.emit('error', error);
				});

				if (value === undefined) {
					const result = await function_();

          const cacheTtl = typeof ttl === 'function' ? ttl(result) : ttl;
					await store.set<T>(key, result, cacheTtl).catch((error) => {
            eventEmitter.emit('error', error);
          });
					return result;
				}

				if (refreshThresholdConfig) {
					const cacheTtl = typeof ttl === 'function' ? ttl(value) : ttl;
					const remainingTtl = await store.ttl(key);
					if (remainingTtl !== -1 && remainingTtl < refreshThresholdConfig) {
						coalesceAsync(`+++${key}`, function_)
							.then(async result => store.set<T>(key, result, cacheTtl))
							.catch(async error => {
								eventEmitter.emit('error', error);
                if (arguments_?.onBackgroundRefreshError) {
									arguments_.onBackgroundRefreshError(error);
								} else {
									// eslint-disable-next-line @typescript-eslint/no-throw-literal
									throw error;
								}
							});
					}
				}

				return value;
			});
		},
		store,
		del: async (key: string) => store.del(key),
		get: async <T>(key: string) => store.get<T>(key),
		set: async (key: string, value: unknown, ttl?: Milliseconds) =>
			store.set(key, value, ttl),
		reset: async () => store.reset(),
    on: (event: 'error', handler: (e: Error) => void) =>
      eventEmitter.on('error', handler),
	};
}
