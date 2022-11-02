import { Cache, Ttl } from './caching';

export type MultiCache = Omit<Cache, 'store'>;

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
  const set = async <T>(key: string, data: T, ttl?: Ttl | undefined) => {
    await Promise.all(caches.map((cache) => cache.set(key, data, ttl)));
  };
  return {
    get,
    set,
    del: async (key) => {
      await Promise.all(caches.map((cache) => cache.del(key)));
    },
    async wrap<T>(key: string, fn: () => Promise<T>, ttl?: Ttl): Promise<T> {
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
        await set<T>(key, result, ttl);
        return result;
      } else {
        for (let j = 0; j < i; j++) {
          await caches[j].set(key, value, ttl);
        }
      }
      return value;
    },
    reset: async () => {
      await Promise.all(caches.map((x) => x.reset()));
    },
  };
}
