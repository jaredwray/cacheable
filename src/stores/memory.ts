import LRUCache, { Options } from 'lru-cache';
import cloneDeep from 'lodash.clonedeep';

import { Config, Cache, Store } from '../caching';

type Lru = LRUCache<string, unknown>;

function clone<T>(object: T): T {
  if (typeof object === 'object' && object !== null) {
    return cloneDeep(object);
  }
  return object;
}

export type MemoryConfig = {
  max?: number;
  sizeCalculation?: (key: string, value: unknown) => number;
  shouldCloneBeforeSet?: boolean;
} & Options<string, unknown> &
  Config;

export type MemoryStore = Store & {
  keyCount: () => number;
  dump: Lru['dump'];
  load: Lru['load'];
};
export type MemoryCache = Cache<MemoryStore>;

/**
 * Wrapper for lru-cache.
 */
export function memoryStore(args?: MemoryConfig): MemoryStore {
  const shouldCloneBeforeSet = args?.shouldCloneBeforeSet !== false; // clone by default
  const isCacheable = args?.isCacheable ?? ((val) => val !== undefined);

  const lruOpts = {
    ...args,
    max: args?.max || 500,
    ttl: args?.ttl !== undefined ? args.ttl : 0,
  };

  const lruCache = new LRUCache<string, unknown>(lruOpts);

  return {
    async del(key) {
      lruCache.delete(key);
    },
    get: async <T>(key: string) => lruCache.get<T>(key),
    keys: async () => [...lruCache.keys()],
    mget: async (...args) => args.map((x) => lruCache.get(x)),
    async mset(args, ttl?) {
      const opt = { ttl: ttl !== undefined ? ttl : lruOpts.ttl } as const;
      for (const [key, value] of args) {
        if (!isCacheable(value))
          throw new Error(`no cacheable value ${JSON.stringify(value)}`);
        if (shouldCloneBeforeSet) lruCache.set(key, clone(value), opt);
        else lruCache.set(key, value, opt);
      }
    },
    async mdel(...args) {
      for (const key of args) lruCache.delete(key);
    },
    async reset() {
      lruCache.clear();
    },
    ttl: async (key) => lruCache.getRemainingTTL(key),
    async set(key, value, opt) {
      if (!isCacheable(value))
        throw new Error(`no cacheable value ${JSON.stringify(value)}`);
      if (shouldCloneBeforeSet) value = clone(value);

      const ttl = opt !== undefined ? opt : lruOpts.ttl;

      lruCache.set(key, value, { ttl });
    },
    /**
     * This method is not available in the caching modules.
     */
    keyCount: () => lruCache.size,
    /**
     * This method is not available in the caching modules.
     */
    dump: () => lruCache.dump(),
    /**
     * This method is not available in the caching modules.
     */
    load: (...args: Parameters<Lru['load']>) => lruCache.load(...args),
  };
}
