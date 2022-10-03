import { Provider, CACHE_MANAGER } from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN } from './cache.module-definition';
import {
  caching,
  Store,
  FactoryStore,
  multiCaching,
  Config,
  MemoryConfig,
} from 'cache-manager';

export type CacheManagerOptions<T extends object = object> = {
  store?: FactoryStore<Store, T> | 'memory';
} & Config &
  MemoryConfig &
  T;

const defaultCacheOptions: CacheManagerOptions = {
  store: 'memory',
  ttl: 5 * 1000,
  max: 100,
};

/**
 * Creates a CacheManager Provider.
 *
 * @publicApi
 */
export function createCacheManager(): Provider {
  return {
    provide: CACHE_MANAGER,
    useFactory: async (
      options: CacheManagerOptions | CacheManagerOptions[],
    ) => {
      if (Array.isArray(options))
        return multiCaching(
          await Promise.all(
            options.map(async (x) => {
              const { store, ...rest } = {
                ...defaultCacheOptions,
                ...(x || {}),
              };
              return await caching(store as never, rest);
            }),
          ),
        );
      const { store, ...rest } = { ...defaultCacheOptions, ...(options || {}) };
      return await caching(store as never, rest);
    },
    inject: [MODULE_OPTIONS_TOKEN],
  };
}
