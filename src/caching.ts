import { MemoryCache, MemoryConfig, memoryStore } from './stores';

export type Config = {
  ttl?: Ttl;
  isCacheable?: (val: unknown) => boolean;
};

export type Ttl = number;

export type Store = {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, data: T, ttl?: Ttl): Promise<void>;
  del(key: string): Promise<void>;
  reset(): Promise<void>;
  mset(args: [string, unknown][], ttl?: Ttl): Promise<void>;
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

export type Cache<S extends Store = Store> = {
  set: (key: string, value: unknown, ttl?: Ttl) => Promise<void>;
  get: <T>(key: string) => Promise<T | undefined>;
  del: (key: string) => Promise<void>;
  reset: () => Promise<void>;
  wrap<T>(key: string, fn: () => Promise<T>): Promise<T>;
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
): Promise<Cache<S> | MemoryCache> {
  let store: Store;
  if (factory === 'memory') store = memoryStore(args as MemoryConfig);
  else if (typeof factory === 'function')
    store = await factory(args as FactoryConfig<T>);
  else store = factory;

  return {
    /**
     * Wraps a function in cache. I.e., the first time the function is run,
     * its results are stored in cache so subsequent calls retrieve from cache
     * instead of calling the function.

     * @example
     * const result = await cache.wrap('key', () => Promise.resolve(1));
     *
     */
    wrap: async <T>(key: string, fn: () => Promise<T>, ttl?: Ttl) => {
      const value = await store.get<T>(key);
      if (value === undefined) {
        const result = await fn();
        await store.set<T>(key, result, ttl);
        return result;
      }
      return value;
    },
    store: store as S,
    del: (key: string) => store.del(key),
    get: <T>(key: string) => store.get<T>(key),
    set: (key: string, value: unknown, ttl?: Ttl) => store.set(key, value, ttl),
    reset: () => store.reset(),
  };
}
