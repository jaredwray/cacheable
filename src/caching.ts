import { coalesceAsync } from 'promise-coalesce';
import { MemoryCache, MemoryConfig, MemoryStore, memoryStore } from './stores';

export type Config = {
  ttl?: Milliseconds;
  refreshThreshold?: Milliseconds;
  isCacheable?: (val: unknown) => boolean;
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
  mset(args: [string, unknown][], ttl?: Milliseconds): Promise<void>;
  mget(...args: string[]): Promise<unknown[]>;
  mdel(...args: string[]): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
};

export type StoreConfig = Config;

export type FactoryConfig<T> = T & Config;
export type FactoryStore<S extends Store, T extends object = never> = (
  config?: FactoryConfig<T>,
) => S | Promise<S>;

export type Stores<S extends Store, T extends object> =
  | 'memory'
  | Store
  | FactoryStore<S, T>;
export type CachingConfig<T> = MemoryConfig | StoreConfig | FactoryConfig<T>;
export type WrapTTL<T> = Milliseconds | ((v: T) => Milliseconds);
export type Cache<S extends Store = Store> = {
  set: (key: string, value: unknown, ttl?: Milliseconds) => Promise<void>;
  get: <T>(key: string) => Promise<T | undefined>;
  del: (key: string) => Promise<void>;
  reset: () => Promise<void>;
  wrap<T>(key: string, fn: () => Promise<T>, ttl?: WrapTTL<T>, refreshThreshold?: Milliseconds): Promise<T>;
  store: S;
};

export async function caching(
  name: 'memory',
  args?: MemoryConfig,
): Promise<MemoryCache>;
export async function caching<S extends Store>(store: S): Promise<Cache<S>>;
export async function caching<S extends Store, T extends object = never>(
  factory: FactoryStore<S, T>,
  args?: FactoryConfig<T>,
): Promise<Cache<S>>;

/**
 * Generic caching interface that wraps any caching library with a compatible interface.
 */
export async function caching<S extends Store, T extends object = never>(
  factory: Stores<S, T>,
  args?: CachingConfig<T>,
): Promise<Cache<S> | Cache<Store> | MemoryCache> {
  if (factory === 'memory') {
    const store = memoryStore(args as MemoryConfig);
    return createCache(store, args as MemoryConfig);
  }
  if (typeof factory === 'function') {
    const store = await factory(args as FactoryConfig<T>);
    return createCache(store, args);
  }

  const store = factory;
  return createCache(store, args);
}

export function createCache(
  store: MemoryStore,
  args?: MemoryConfig,
): MemoryCache;

export function createCache(store: Store, args?: Config): Cache<Store>;

/**
 * Create cache instance by store (non-async).
 */
export function createCache<S extends Store, C extends Config>(
  store: S,
  args?: C,
): Cache<S> {
  return {
    /**
     * Wraps a function in cache. I.e., the first time the function is run,
     * its results are stored in cache so subsequent calls retrieve from cache
     * instead of calling the function.

     * @example
     * const result = await cache.wrap('key', () => Promise.resolve(1));
     *
     */
    wrap: async <T>(key: string, fn: () => Promise<T>, ttl?: WrapTTL<T>, refreshThreshold?: Milliseconds) => {
      const refreshThresholdConfig = refreshThreshold || args?.refreshThreshold || 0;
      return coalesceAsync(key, async () => {
        const value = await store.get<T>(key);
        if (value === undefined) {
          const result = await fn();
          const cacheTTL = typeof ttl === 'function' ? ttl(result) : ttl;
          await store.set<T>(key, result, cacheTTL);
          return result;
        } else if (refreshThresholdConfig) {
          const cacheTTL = typeof ttl === 'function' ? ttl(value) : ttl;
          const remainingTtl = await store.ttl(key);
          if (remainingTtl !== -1 && remainingTtl < refreshThresholdConfig) {
            coalesceAsync(`+++${key}`, fn).then((result) =>
              store.set<T>(key, result, cacheTTL),
            );
          }
        }
        return value;
      });
    },
    store: store as S,
    del: (key: string) => store.del(key),
    get: <T>(key: string) => store.get<T>(key),
    set: (key: string, value: unknown, ttl?: Milliseconds) =>
      store.set(key, value, ttl),
    reset: () => store.reset(),
  };
}
