import { Cache, Milliseconds, WrapTTL } from './caching';

export type MultiCache = Omit<Cache, 'store'> &
  Pick<Cache['store'], 'mset' | 'mget' | 'mdel'>;

/**
 * Module that lets you specify a hierarchy of caches.
 */
export function multiCaching<Caches extends Cache[]>(
  caches: Caches,
): MultiCache {
  const get = async <T>(key: string) => {
    for (const cache of caches) {
      try {
        const val = await cache.get<T>(key);
        if (val !== undefined) return val;
      } catch (e) {}
    }
  };
  const set = async <T>(
    key: string,
    data: T,
    ttl?: Milliseconds | undefined,
  ) => {
    await Promise.all(caches.map((cache) => cache.set(key, data, ttl)));
  };

  return {
    get,
    set,
    del: async (key) => {
      await Promise.all(caches.map((cache) => cache.del(key)));
    },
    async wrap<T>(
      key: string,
      fn: () => Promise<T>,
      ttl?: WrapTTL<T>,
      refreshThreshold?: Milliseconds
    ): Promise<T> {
      let value: T | undefined;
      let i = 0;
      for (; i < caches.length; i++) {
        try {
          value = await caches[i].get<T>(key);
          if (value !== undefined) break;
        } catch (e) {}
      }
      if (value === undefined) {
        const result = await fn();
        const cacheTTL = typeof ttl === 'function' ? ttl(result) : ttl;
        await set<T>(key, result, cacheTTL);
        return result;
      } else {
        const cacheTTL = typeof ttl === 'function' ? ttl(value) : ttl;
        Promise.all(
          caches.slice(0, i).map((cache) => cache.set(key, value, cacheTTL)),
        ).then();
        caches[i].wrap(key, fn, ttl, refreshThreshold).then(); // call wrap for store for internal refreshThreshold logic, see: src/caching.ts caching.wrap
      }
      return value;
    },
    reset: async () => {
      await Promise.all(caches.map((x) => x.reset()));
    },
    mget: async (...keys: string[]) => {
      const values = new Array(keys.length).fill(undefined);
      for (const cache of caches) {
        if (values.every((x) => x !== undefined)) break;
        try {
          const val = await cache.store.mget(...keys);
          val.forEach((v, i) => {
            if (values[i] === undefined && v !== undefined) values[i] = v;
          });
        } catch (e) {}
      }
      return values;
    },
    mset: async (args: [string, unknown][], ttl?: Milliseconds) => {
      await Promise.all(caches.map((cache) => cache.store.mset(args, ttl)));
    },
    mdel: async (...keys: string[]) => {
      await Promise.all(caches.map((cache) => cache.store.mdel(...keys)));
    },
  };
}
