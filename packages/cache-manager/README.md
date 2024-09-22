![Logo](./.github/assets/logo.png)

[![test](https://github.com/timphandev/keyv-caching/actions/workflows/ci.yml/badge.svg)](https://github.com/timphandev/keyv-caching/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/timphandev/keyv-caching)](https://github.com/timphandev/keyv-caching/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/dm/keyv-caching)](https://npmjs.com/package/keyv-caching)
![npm](https://img.shields.io/npm/v/keyv-caching)

# Simple and fast NodeJS caching module.
A cache module for NodeJS that allows easy wrapping of functions in cache, tiered caches, and a consistent interface.
- Made with Typescript and compatible with [ESModules](https://nodejs.org/docs/latest-v14.x/api/esm.html).
- Easy way to wrap any function in cache, supports a mechanism to refresh expiring cache keys in background.
- Tiered caches -- data gets stored in each cache and fetched from the highest priority cache(s) first.
- Use with any [Keyv](https://keyv.org/)-compatible storage adapter.
- 100% test coverage via [vitest](https://github.com/vitest-dev/vitest).

## Table of Contents
* [Installation](#installation)
* [Quick start](#quick-start)
* [Methods](#methods)
  * [.set](#set)
  * [.get](#get)
  * [.del](#del)
  * [.clear](#clear)
  * [.wrap](#wrap)
* [Events](#events)
  * [.set](#set)
  * [.del](#del)
  * [.clear](#clear)
  * [.refresh](#refresh)
* [Contribute](#contribute)
* [License](#license)

## Installation

```sh
yarn add keyv-caching
```

By default, everything is stored in memory; you can optionally also install a storage adapter; choose one from any of the storage adapters supported by Keyv:

```sh
yarn add @keyv/redis
yarn add @keyv/memcache
yarn add @keyv/mongo
yarn add @keyv/sqlite
yarn add @keyv/postgres
yarn add @keyv/mysql
yarn add @keyv/etcd
```

Please read [Keyv document](https://keyv.org/docs/) for more information.

## Quick start
```typescript
import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'
import KeyvSqlite from '@keyv/sqlite'
import { createCache } from 'keyv-caching';

// Memory store by default
const cache = createCache()

// Single store
const cache = createCache({
  stores: [new Keyv()],
})

// Multiple stores
const cache = createCache({
  stores: [
    // Redis store
    new Keyv({
      store: new KeyvRedis('redis://user:pass@localhost:6379'),
    }),

    // Sqlite store
    new Keyv({
      store: new KeyvSqlite('cache.db'),
    }),
  ],
})

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
### Options
- **stores**?: Keyv[]

    List of Keyv instance. Please refer to the [Keyv document](https://keyv.org/docs/#3.-create-a-new-keyv-instance) for more information.
- **ttl**?: number - Default time to live in milliseconds.

    The time to live in milliseconds. This is the maximum amount of time that an item can be in the cache before it is removed.
- **refreshThreshold**?: number - Default refreshThreshold in milliseconds.

    If the remaining TTL is less than **refreshThreshold**, the system will update the value asynchronously in background.

## Methods
### set
`set(key, value, [ttl]): Promise<value>`

Sets a key value pair. It is possible to define a ttl (in miliseconds). An error will be throw on any failed

```ts
await cache.set('key-1', 'value 1')

// expires after 5 seconds
await cache.set('key 2', 'value 2', 5000)
```
See unit tests in [`test/set.test.ts`](./test/set.test.ts) for more information.

### get
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

### del
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

### clear
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

### wrap
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

## Events
### set
Fired when a key has been added or changed.

```ts
cache.on('set', ({ key, value, error }) => {
	// ... do something ...
})
```

### del
Fired when a key has been removed manually.

```ts
cache.on('del', ({ key, error }) => {
	// ... do something ...
})
```

### clear
Fired when the cache has been flushed.

```ts
cache.on('clear', (error) => {
  if (error) {
    // ... do something ...
  }
})
```

### refresh
Fired when the cache has been refreshed in the background.

```ts
cache.on('refresh', ({ key, value, error }) => {
  if (error) {
    // ... do something ...
  }
})
```

See unit tests in [`test/events.test.ts`](./test/events.test.ts) for more information.

## Contribute

If you would like to contribute to the project, please read how to contribute here [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Released under the [MIT license](./LICENSE).