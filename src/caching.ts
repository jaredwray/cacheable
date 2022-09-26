import { MemoryCache, MemoryConfig, MemoryStore, memoryStore } from './stores';

export interface Config {
  ttl?: Ttl;
  isCacheable?: (val: unknown) => boolean;
}

export type Ttl = number;

export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, data: T, ttl?: Ttl): Promise<void>;
  del(key: string[] | string): Promise<void>;
  reset(): Promise<void>;
  mset(args: [string, unknown][], ttl?: Ttl): Promise<void>;
  mget(...args: string[]): Promise<unknown[]>;
  keys(): Promise<string[]>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
}

export type StoreConfig = Config;

export type FactoryConfig<T> = T & Config;
type FactoryStore<S extends Store, T extends object = never> = (
  config?: FactoryConfig<T>,
) => S | Promise<S>;

type Stores<S extends Store, T extends object> =
  | 'memory'
  | Store
  | FactoryStore<S, T>;
type CachingConfig<T> = MemoryConfig | StoreConfig | FactoryConfig<T>;

export interface Cache<S extends Store = Store> {
  set: S['set'];
  get: S['get'];
  del: S['del'];
  reset: S['reset'];
  wrap<T>(key: string, fn: () => Promise<T>): Promise<T>;
  store: S;
}

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
): Promise<Cache<S | MemoryStore>> {
  let store: Store;
  if (factory === 'memory') {
    store = memoryStore(args as MemoryConfig);
  } else if (typeof factory === 'function') {
    store = await factory(args as FactoryConfig<T>);
  } else {
    store = factory;
  }

  return {
    /**
     * Wraps a function in cache. I.e., the first time the function is run,
     * its results are stored in cache so subsequent calls retrieve from cache
     * instead of calling the function.

     * @example
     * const result = await cache.wrap('key', () => Promise.resolve(1));
     *
     */
    wrap: async <T>(key: string, fn: () => Promise<T>) => {
      const value = await store.get<T>(key);
      if (value === undefined) {
        const result = await fn();
        await store.set<T>(key, result);
        return result;
      }
      return value;
    },
    store: store as S,
    del: (key: string | string[]) => store.del(key),
    get: <T>(key: string) => store.get<T>(key),
    set: (key: string, value: unknown, ttl?: Ttl) => store.set(key, value, ttl),
    reset: () => store.reset(),
  };
}
