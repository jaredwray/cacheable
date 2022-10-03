import {
  Module,
  DynamicModule,
  CACHE_MANAGER,
  Provider,
  Type,
  ConfigurableModuleAsyncOptions,
} from '@nestjs/common';
import { createCacheManager, CacheManagerOptions } from './cache.provider';
import {
  CacheOptionsFactory,
  ConfigurableModuleClass,
} from './cache.module-definition';

export interface CacheModuleAsyncOptions<StoreConfig extends object = object>
  extends ConfigurableModuleAsyncOptions<
    CacheModuleOptions<StoreConfig>,
    keyof CacheOptionsFactory
  > {
  /**
   * Injection token resolving to an existing provider. The provider must implement
   * the `CacheOptionsFactory` interface.
   */
  useExisting?: Type<CacheOptionsFactory<StoreConfig>>;
  /**
   * Injection token resolving to a class that will be instantiated as a provider.
   * The class must implement the `CacheOptionsFactory` interface.
   */
  useClass?: Type<CacheOptionsFactory<StoreConfig>>;
  /**
   * Function returning options (or a Promise resolving to options) to configure the
   * cache module.
   */
  useFactory?: (
    ...args: any[]
  ) =>
    | Promise<CacheModuleOptions<StoreConfig>>
    | CacheModuleOptions<StoreConfig>;
  /**
   * Dependencies that a Factory may inject.
   */
  inject?: any[];
  /**
   * Extra providers to be registered within a scope of this module.
   */
  extraProviders?: Provider[];
  /**
   * If "true', register `CacheModule` as a global module.
   */
  isGlobal?: boolean;
}

export type CacheModuleOptions<StoreConfig extends object = object> =
  CacheManagerOptions<StoreConfig> & {
    /**
     * If "true', register `CacheModule` as a global module.
     */
    isGlobal?: boolean;
  };

/**
 * Interface describing a `CacheOptionsFactory`.  Providers supplying configuration
 * options for the Cache module must implement this interface.
 *
 * @see [Async configuration](https://docs.nestjs.com/techniques/caching#async-configuration)
 *
 * @publicApi
 */
/**
 * Module that provides Nest cache-manager.
 *
 * @see [Caching](https://docs.nestjs.com/techniques/caching)
 *
 * @publicApi
 */
@Module({
  providers: [createCacheManager()],
  exports: [CACHE_MANAGER],
})
export class CacheModule extends ConfigurableModuleClass {
  /**
   * Configure the cache manager statically.
   *
   * @param options options to configure the cache manager
   *
   * @see [Customize caching](https://docs.nestjs.com/techniques/caching#customize-caching)
   */
  static register<StoreConfig extends object = object>(
    options: CacheModuleOptions<StoreConfig> = {} as any,
  ): DynamicModule {
    return {
      global: options.isGlobal,
      ...super.register(options),
    };
  }

  /**
   * Configure the cache manager dynamically.
   *
   * @param options method for dynamically supplying cache manager configuration
   * options
   *
   * @see [Async configuration](https://docs.nestjs.com/techniques/caching#async-configuration)
   */
  static registerAsync<StoreConfig extends object = object>(
    options: CacheModuleAsyncOptions<StoreConfig>,
  ): DynamicModule {
    const moduleDefinition = super.registerAsync(options);

    return {
      global: options.isGlobal,
      ...moduleDefinition,
      providers: options.extraProviders
        ? moduleDefinition.providers.concat(options.extraProviders)
        : moduleDefinition.providers,
    };
  }
}
