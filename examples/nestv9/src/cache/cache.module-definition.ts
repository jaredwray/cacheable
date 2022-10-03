import { ConfigurableModuleBuilder } from '@nestjs/common';
import { CacheModuleOptions } from './cache.module';

export interface CacheOptionsFactory<StoreConfig extends object = object> {
  createCacheOptions():
    | Promise<CacheModuleOptions<StoreConfig>>
    | CacheModuleOptions<StoreConfig>;
}
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<CacheModuleOptions>({
    moduleName: 'Cache',
  })
    .setFactoryMethodName('createCacheOptions' as keyof CacheOptionsFactory)
    .build();
