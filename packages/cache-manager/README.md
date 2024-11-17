[<img align="center" src="https://cacheable.org/symbol.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# cache-manager
[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/cache-manager)](https://npmjs.com/package/cache-manager)
[![npm](https://img.shields.io/npm/v/cache-manager)](https://npmjs.com/package/cache-manager)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

# Simple and fast NodeJS caching module.
A cache module for NodeJS that allows easy wrapping of functions in cache, tiered caches, and a consistent interface.
- Made with Typescript and compatible with [ESModules](https://nodejs.org/docs/latest-v14.x/api/esm.html).
- Easy way to wrap any function in cache, supports a mechanism to refresh expiring cache keys in background.
- Tiered caches -- data gets stored in each cache and fetched from the highest priority cache(s) first.
- `nonBlocking` option that optimizes how the system handles multiple stores.
- Use with any [Keyv](https://keyv.org/) compatible storage adapter.
- 100% test coverage via [vitest](https://github.com/vitest-dev/vitest).

We moved to using [Keyv](https://keyv.org/) which are more actively maintained and have a larger community.

A special thanks to [Tim Phan](https://github.com/timphandev) who took `cache-manager` v5 and ported it to [Keyv](https://keyv.org/) which is the foundation of v6. 🎉 Another special thanks to [Doug Ayers](https://github.com/douglascayers) who wrote `promise-coalesce` which was used in v5 and now embedded in v6.

If you are looking for older documentation you can find it here:
* [v5 Documentation](https://github.com/jaredwray/cacheable/blob/main/packages/cache-manager/READMEv5.md)
* [v4 Documentation](https://github.com/jaredwray/cacheable/blob/main/packages/cache-manager/READMEv4.md)

## Table of Contents
* [Installation](#installation)
* [Quick start](#quick-start)
* [Using `CacheableMemory` or `lru-cache` as storage adapter](#using-cacheablememory-or-lru-cache-as-storage-adapter)
* [Options](#options)
* [Methods](#methods)
  * [.set](#set)
  * [.mset](#mset)
  * [.get](#get)
  * [.mget](#mget)
  * [.del](#del)
  * [.mdel](#mdel)
  * [.clear](#clear)
  * [.wrap](#wrap)
* [Events](#events)
  * [.set](#set)
  * [.del](#del)
  * [.clear](#clear)
  * [.refresh](#refresh)
* [Update on `redis` and `ioredis` Support](#update-on-redis-and-ioredis-support)
* [Using Legacy Storage Adapters](#using-legacy-storage-adapters)
* [Contribute](#contribute)
* [License](#license)

# Installation

```sh
npm install cache-manager
```

By default, everything is stored in memory; you can optionally also install a storage adapter; choose one from any of the storage adapters supported by Keyv:

```sh
npm install @keyv/redis
npm install @keyv/memcache
npm install @keyv/mongo
npm install @keyv/sqlite
npm install @keyv/postgres
npm install @keyv/mysql
npm install @keyv/etcd
```
In addition Keyv supports other storage adapters such as `lru-cache` and `CacheableMemory` from Cacheable (more examples below). Please read [Keyv document](https://keyv.org/docs/) for more information.

# Quick start
```typescript
import { Keyv } from 'keyv';
import { createCache } from 'cache-manager';

// Memory store by default
const cache = createCache()

// Single store which is in memory
const cache = createCache({
  stores: [new Keyv()],
})
```
Here is an example of doing layer 1 and layer 2 caching with the in-memory being `CacheableMemory` from Cacheable and the second layer being `@keyv/redis`:

```ts
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { CacheableMemory } from 'cacheable';
import { createCache } from 'cache-manager';

// Multiple stores
const cache = createCache({
  stores: [
    //  High performance in-memory cache with LRU and TTL
    new Keyv({
      store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
    }),

    //  Redis Store
    new Keyv({
      store: new KeyvRedis('redis://user:pass@localhost:6379'),
    }),
  ],
})
```

Once it is created, you can use the cache object to set, get, delete, and wrap functions in cache.

```ts

// With default ttl and refreshThreshold
const cache = createCache({
  ttl: 10000,
  refreshThreshold: 3000,
})

await cache.set('foo', 'bar')
// => bar

await cache.get('foo')
// => bar

await cache.del('foo')
// => true

await cache.get('foo')
// => null

await cache.wrap('key', () => 'value')
// => value
```

# Using CacheableMemory or lru-cache as storage adapter

Because we are using [Keyv](https://keyv.org/), you can use any storage adapter that Keyv supports such as `lru-cache` or `CacheableMemory` from Cacheable. Below is an example of using `CacheableMemory`:

In this example we are using `CacheableMemory` from Cacheable which is a fast in-memory cache that supports LRU and and TTL expiration.

```ts
import { createCache } from 'cache-manager';
import { Keyv } from 'keyv';
import { KeyvCacheableMemory } from 'cacheable';

const store = new KeyvCacheableMemory({ ttl: 60000, lruSize: 5000 });
const keyv = new Keyv({ store });
const cache = createCache({ stores: [keyv] });
```

Here is an example using `lru-cache`:

```ts
import { createCache } from 'cache-manager';
import { Keyv } from 'keyv';
import { LRU } from 'lru-cache';

const keyv = new Keyv({ store: new LRU({ max: 5000, maxAge: 60000 }) });
const cache = createCache({ stores: [keyv] });
```

## Options
- **stores**?: Keyv[]

    List of Keyv instance. Please refer to the [Keyv document](https://keyv.org/docs/#3.-create-a-new-keyv-instance) for more information.
- **ttl**?: number - Default time to live in milliseconds.

    The time to live in milliseconds. This is the maximum amount of time that an item can be in the cache before it is removed.
- **refreshThreshold**?: number - Default refreshThreshold in milliseconds.

    If the remaining TTL is less than **refreshThreshold**, the system will update the value asynchronously in background.

- **nonBlocking**?: boolean - Default false

    If set to true, the system will not block when multiple stores are used. Here is how it affects the type of functions:
    * `set and mset` - will not wait for all stores to finish.
    * `get and mget` - will return the first (fastest) value found.
    * `del and mdel` - will not wait for all stores to finish.
    * `clear` - will not wait for all stores to finish.
    * `wrap` - will do the same as `get` and `set` (return the first value found and not wait for all stores to finish).

# Methods
## set
`set(key, value, [ttl]): Promise<value>`

Sets a key value pair. It is possible to define a ttl (in milliseconds). An error will be throw on any failed

```ts
await cache.set('key-1', 'value 1')

// expires after 5 seconds
await cache.set('key 2', 'value 2', 5000)
```
See unit tests in [`test/set.test.ts`](./test/set.test.ts) for more information.

## mset

`mset(keys: [ { key, value, ttl } ]): Promise<true>`

Sets multiple key value pairs. It is possible to define a ttl (in milliseconds). An error will be throw on any failed

```ts
await cache.mset([
  { key: 'key-1', value: 'value 1' },
  { key: 'key-2', value: 'value 2', ttl: 5000 },
]);
```

## get
`get(key): Promise<value>`

Gets a saved value from the cache. Returns a null if not found or expired. If the value was found it returns the value.

```ts
await cache.set('key', 'value')

await cache.get('key')
// => value

await cache.get('foo')
// => null
```
See unit tests in [`test/get.test.ts`](./test/get.test.ts) for more information.

## mget

`mget(keys: [key]): Promise<value[]>`

Gets multiple saved values from the cache. Returns a null if not found or expired. If the value was found it returns the value.

```ts
await cache.mset([
  { key: 'key-1', value: 'value 1' },
  { key: 'key-2', value: 'value 2' },
]);

await cache.mget(['key-1', 'key-2', 'key-3'])
// => ['value 1', 'value 2', null]
```

## del
`del(key): Promise<true>`

Delete a key, an error will be throw on any failed.

```ts
await cache.set('key', 'value')

await cache.get('key')
// => value

await cache.del('key')

await cache.get('key')
// => null
```
See unit tests in [`test/del.test.ts`](./test/del.test.ts) for more information.

## mdel

`mdel(keys: [key]): Promise<true>`

Delete multiple keys, an error will be throw on any failed.

```ts
await cache.mset([
  { key: 'key-1', value: 'value 1' },
  { key: 'key-2', value: 'value 2' },
]);

await cache.mdel(['key-1', 'key-2'])
```

## clear
`clear(): Promise<true>`

Flush all data, an error will be throw on any failed.

```ts
await cache.set('key-1', 'value 1')
await cache.set('key-2', 'value 2')

await cache.get('key-1')
// => value 1
await cache.get('key-2')
// => value 2

await cache.clear()

await cache.get('key-1')
// => null
await cache.get('key-2')
// => null
```
See unit tests in [`test/clear.test.ts`](./test/clear.test.ts) for more information.

## wrap
`wrap(key, fn: async () => value, [ttl], [refreshThreshold]): Promise<value>`

Wraps a function in cache. The first time the function is run, its results are stored in cache so subsequent calls retrieve from cache instead of calling the function.

If `refreshThreshold` is set and the remaining TTL is less than `refreshThreshold`, the system will update the value asynchronously. In the meantime, the system will return the old value until expiration.

```typescript
await cache.wrap('key', () => 1, 5000, 3000)
// call function then save the result to cache
// =>  1

await cache.wrap('key', () => 2, 5000, 3000)
// return data from cache, function will not be called again
// => 1

// wait 3 seconds
await sleep(3000)

await cache.wrap('key', () => 2, 5000, 3000)
// return data from cache, call function in background and save the result to cache
// =>  1

await cache.wrap('key', () => 3, 5000, 3000)
// return data from cache, function will not be called
// =>  2

await cache.wrap('error', () => {
  throw new Error('failed')
})
// => error
```
**NOTES:**

* The store that will be checked for refresh is the one where the key will be found first (highest priority).
* If the threshold is low and the worker function is slow, the key may expire and you may encounter a racing condition with updating values.
* If no `ttl` is set for the key, the refresh mechanism will not be triggered.

See unit tests in [`test/wrap.test.ts`](./test/wrap.test.ts) for more information.

## disconnect

`disconnect(key): Promise<void>`

Will disconnect from the relevant store(s). It is highly recomended to use this when using a [Keyv](https://keyv.org/) storage adapter that requires a disconnect. For each storage adapter, the use case for when to use disconnect is different. An example is that `@keyv/redis` should be used only when you are done with the cache.

```ts
await cache.disconnect();
```

See unit tests in [`test/disconnect.test.ts`](./test/disconnect.test.ts) for more information.

# Events
## set
Fired when a key has been added or changed.

```ts
cache.on('set', ({ key, value, error }) => {
	// ... do something ...
})
```

## del
Fired when a key has been removed manually.

```ts
cache.on('del', ({ key, error }) => {
	// ... do something ...
})
```

## clear
Fired when the cache has been flushed.

```ts
cache.on('clear', (error) => {
  if (error) {
    // ... do something ...
  }
})
```

## refresh
Fired when the cache has been refreshed in the background.

```ts
cache.on('refresh', ({ key, value, error }) => {
  if (error) {
    // ... do something ...
  }
})
```

See unit tests in [`test/events.test.ts`](./test/events.test.ts) for more information.

# Update on redis and ioredis Support

We will not be supporting `cache-manager-ioredis-yet` or `cache-manager-redis-yet` in the future as we have moved to using `Keyv` as the storage adapter `@keyv/redis`.

# Using Legacy Storage Adapters

There are many storage adapters built for `cache-manager` and because of that we wanted to provide a way to use them with `KeyvAdapter`. Below is an example of using `cache-manager-redis-yet`:

```ts
import { createCache, KeyvAdapter } from 'cache-manager';
import { Keyv } from 'keyv';
import { redisStore } from 'cache-manager-redis-yet';

const adapter = new KeyvAdapter( await redisStore() );
const cache = createCache({
  stores: [new Keyv({ store: adapter })],
});
```

This adapter will allow you to add in any storage adapter. If there are issues it needs to follow `CacheManagerStore` interface.

# Contribute

If you would like to contribute to the project, please read how to contribute here [CONTRIBUTING.md](https://github.com/jaredwray/cacheable/blob/main/CONTRIBUTING.md).

# License

[MIT © Jared Wray ](./LICENSE)
