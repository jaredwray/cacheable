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
    async wrap<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const value = await get<T>(key);
      if (value === undefined) {
        const result = await fn();
        await set<T>(key, result);
        return result;
      }
      return value;
    },
    reset: async () => {
      await Promise.all(caches.map((x) => x.reset()));
    },
  };
}
