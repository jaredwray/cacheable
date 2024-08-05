[<img align="center" src="https://jaredwray.com/images/cacheable_white.svg" alt="keyv">](https://github.com/jaredwray/cacheable)

# cache-manager 
[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/dm/cache-manager)](https://npmjs.com/package/cache-manager)
![npm](https://img.shields.io/npm/v/cache-manager)

# Flexible NodeJS cache module

A cache module for nodejs that allows easy wrapping of functions in cache, tiered caches, and a consistent interface. This module is now part of the [Cacheable](https://cacheable.org) project.

## Table of Contents
* [Features](#features)
* [Installation](#installation)
* [Usage Examples](#usage-examples)
  * [Single Store](#single-store)
  * [Multi-Store](#multi-store)
  * [Cache Manager Options](#cache-manager-options)
  * [Refresh cache keys in background](#refresh-cache-keys-in-background)
  * [Error Handling](#error-handling)
  * [Express Middleware](#express-middleware)
  * [Store Engines](#store-engines)
* [Contribute](#contribute)
* [License](#license)

## Features

- Made with Typescript and compatible with [ESModules](https://nodejs.org/docs/latest-v14.x/api/esm.html)
- Easy way to wrap any function in cache.
- Tiered caches -- data gets stored in each cache and fetched from the highest.
  priority cache(s) first.
- Use any cache you want, as long as it has the same API.
- 100% test coverage via [vitest](https://github.com/vitest-dev/vitest).

## Installation

    pnpm install cache-manager

## Usage Examples

### Single Store

```typescript
import { caching } from 'cache-manager';

const memoryCache = await caching('memory', {
  max: 100,
  ttl: 10 * 1000 /*milliseconds*/,
});

const ttl = 5 * 1000; /*milliseconds*/
await memoryCache.set('foo', 'bar', ttl);

console.log(await memoryCache.get('foo'));
// >> "bar"

await memoryCache.del('foo');

console.log(await memoryCache.get('foo'));
// >> undefined

const getUser = (id: string) => new Promise.resolve({ id: id, name: 'Bob' });

const userId = 123;
const key = 'user_' + userId;

console.log(await memoryCache.wrap(key, () => getUser(userId), ttl));
// >> { id: 123, name: 'Bob' }
```

See unit tests in [`test/caching.test.ts`](./test/caching.test.ts) for more information.

#### Example setting/getting several keys with mset() and mget()

```typescript
await memoryCache.store.mset(
  [
    ['foo', 'bar'],
    ['foo2', 'bar2'],
  ],
  ttl,
);

console.log(await memoryCache.store.mget('foo', 'foo2'));
// >> ['bar', 'bar2']

// Delete keys with mdel() passing arguments...
await memoryCache.store.mdel('foo', 'foo2');
```

#### Custom Stores

You can use your own custom store by creating one with the same API as the built-in memory stores.

- [Example Custom Store lru-cache](https://github.com/jaredwray/cacheable/blob/main/packages/cache-manager/src/stores/memory.ts)
- [Example Custom Store redis](https://github.com/jaredwray/cacheable/tree/main/packages/cache-manager-redis-yet)
- [Example Custom Store ioredis](https://github.com/jaredwray/cacheable/tree/main/packages/cache-manager-ioredis-yet)

#### Create single cache store synchronously

As `caching()` requires async functionality to resolve some stores, this is not well-suited to use for default function/constructor parameters etc.

If you need to create a cache store synchronously, you can instead use `createCache()`:

```typescript
import { createCache, memoryStore } from 'cache-manager';

// Create memory cache synchronously
const memoryCache = createCache(memoryStore({
  max: 100,
  ttl: 10 * 1000 /*milliseconds*/,
}));

// Default parameter in function
function myService(cache = createCache(memoryStore())) {}

// Default parameter in class constructor
const DEFAULT_CACHE = createCache(memoryStore(), { ttl: 60 * 1000 });
// ...
class MyService {
  constructor(private cache = DEFAULT_CACHE) {}
}
```

### Multi-Store

```typescript
import { multiCaching } from 'cache-manager';

const multiCache = multiCaching([memoryCache, someOtherCache]);
const userId2 = 456;
const key2 = 'user_' + userId;
const ttl = 5;

// Sets in all caches.
await multiCache.set('foo2', 'bar2', ttl);

// Fetches from highest priority cache that has the key.
console.log(await multiCache.get('foo2'));
// >> "bar2"

// Delete from all caches
await multiCache.del('foo2');

// Sets multiple keys in all caches.
// You can pass as many key, value tuples as you want
await multiCache.mset(
  [
    ['foo', 'bar'],
    ['foo2', 'bar2'],
  ],
  ttl
);

// mget() fetches from highest priority cache.
// If the first cache does not return all the keys,
// the next cache is fetched with the keys that were not found.
// This is done recursively until either:
// - all have been found
// - all caches has been fetched
console.log(await multiCache.mget('key', 'key2'));
// >> ['bar', 'bar2']

// Delete keys with mdel() passing arguments...
await multiCache.mdel('foo', 'foo2');
```

See unit tests in [`test/multi-caching.test.ts`](./test/multi-caching.test.ts) for more information.

### Cache Manager Options

The `caching` function accepts an options object as the second parameter. The following options are available:
* ttl: The time to live in milliseconds. This is the maximum amount of time that an item can be in the cache before it is removed.
* refreshThreshold: discussed in details below.
* isCacheable: a function to determine whether the value is cacheable or not.
* onBackgroundRefreshError: a function to handle errors that occur during background refresh.

```typescript
import { caching } from 'cache-manager';

const memoryCache = await caching('memory', {
  max: 100,
  ttl: 10 * 1000 /*milliseconds*/,
  shouldCloneBeforeSet: false, // this is set true by default (optional)
});
```

When creating a memory store, you also get these addition options:
* max: The maximum number of items that can be stored in the cache. If the cache is full, the least recently used item is removed.
* shouldCloneBeforeSet: If true, the value will be cloned before being set in the cache. This is set to `true` by default.

### Refresh cache keys in background

Both the `caching` and `multicaching` modules support a mechanism to refresh expiring cache keys in background when using the `wrap` function.  
This is done by adding a `refreshThreshold` attribute while creating the caching store or passing it to the `wrap` function.

If `refreshThreshold` is set and after retrieving a value from cache the TTL will be checked.  
If the remaining TTL is less than `refreshThreshold`, the system will update the value asynchronously,  
following same rules as standard fetching. In the meantime, the system will return the old value until expiration.

NOTES:

* In case of multicaching, the store that will be checked for refresh is the one where the key will be found first (highest priority).
* If the threshold is low and the worker function is slow, the key may expire and you may encounter a racing condition with updating values.
* The background refresh mechanism currently does not support providing multiple keys to `wrap` function.
* If no `ttl` is set for the key, the refresh mechanism will not be triggered. For redis, the `ttl` is set to -1 by default.

For example, pass the refreshThreshold to `caching` like this:

```typescript
const memoryCache = await caching('memory', {
  max: 100,
  ttl: 10 * 1000 /*milliseconds*/,
  refreshThreshold: 3 * 1000 /*milliseconds*/,
  
  /* optional, but if not set, background refresh error will be an unhandled
   * promise rejection, which might crash your node process */
  onBackgroundRefreshError: (error) => { /* log or otherwise handle error */ }
});
```

When a value will be retrieved from Redis with a TTL minor than 3sec, the value will be updated in the background.

## Error Handling

`multiCaching` now does not throw errors by default. Instead, all errors are evented through the `error` event. Here is an example on how to use it:

```javascript
const multicache = await multiCaching([memoryCache, someOtherCache]);
multicache.on('error', (error) => {
  console.error('Cache error:', error);
});
```

## Using non-blocking set with wrap
By default, when using `wrap` the value is set in the cache before the function returns. 
While this behaviour can prevent additional calls to downstream resources, it can also slow down the response time.
This can be changed by setting the `nonBlockingSet` option to `true`. 
Doing will make the function return before the value is set in the cache.
The setting applies to both single and multi caches. 

```typescript
cache.wrap('key', () => fetchValue(), 1000, 500, {nonBlockingSet: true});
```

## Express Middleware

This example sets up an Express application with a caching mechanism using cache-manager. The cacheMiddleware checks if the response for a request is already cached and returns it if available. If not, it proceeds to the route handler, caches the response, and then returns it. This helps to reduce the load on the server by avoiding repeated processing of the same requests.

```typescript
// The code imports the necessary modules using ES module syntax:
import { caching } from 'cache-manager';
import express from 'express';

// The memory cache is initialized using cache-manager with a maximum of 100 items and a TTL (time-to-live) of 10 seconds:
const memoryCache = await caching('memory', {
  max: 100,
  ttl: 10 * 1000 /*milliseconds*/
});

const app = express();
const port = 3000;

// A middleware function is defined to check the cache before processing the request. If the response is found in the cache, it is returned immediately. If not, the request proceeds to the route handler, and the response is cached before being sent:
const cacheMiddleware = async (req, res, next) => {
  const key = req.originalUrl;

  try {
    const cachedResponse = await memoryCache.get(key);
    if (cachedResponse) {
      // Cache hit, return the cached response
      return res.send(cachedResponse);
    } else {
      // Cache miss, proceed to the route handler
      res.sendResponse = res.send;
      res.send = async (body) => {
        // Store the response in cache
        await memoryCache.set(key, body);
        res.sendResponse(body);
      };
      next();
    }
  } catch (err) {
    next(err);
  }
};

// The cacheMiddleware is applied to the /data route, which simulates a slow database call with a 2-second delay:
app.get('/data', cacheMiddleware, (req, res) => {
  // Simulate a slow database call
  setTimeout(() => {
    res.send({ data: 'This is some data', timestamp: new Date() });
  }, 2000); // 2 seconds delay
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

```

## Store Engines

### Official and updated to last version

- [node-cache-manager-redis-yet](https://github.com/jaredwray/cacheable/packages/cache-manager-redis-yet) (uses [node_redis](https://github.com/NodeRedis/node_redis))

- [node-cache-manager-ioredis-yet](https://github.com/jaredwray/cacheable/packages/cache-manager-ioredis-yet) (uses [ioredis](https://github.com/luin/ioredis))

### Third party

- [node-cache-manager-redis](https://github.com/dial-once/node-cache-manager-redis) (uses [sol-redis-pool](https://github.com/joshuah/sol-redis-pool))

- [node-cache-manager-redis-store](https://github.com/dabroek/node-cache-manager-redis-store) (uses [node_redis](https://github.com/NodeRedis/node_redis))

- [node-cache-manager-ioredis](https://github.com/Tirke/node-cache-manager-ioredis) (uses [ioredis](https://github.com/luin/ioredis))

- [node-cache-manager-mongodb](https://github.com/v4l3r10/node-cache-manager-mongodb)

- [node-cache-manager-mongoose](https://github.com/disjunction/node-cache-manager-mongoose)

- [node-cache-manager-fs-binary](https://github.com/sheershoff/node-cache-manager-fs-binary)

- [node-cache-manager-fs-hash](https://github.com/rolandstarke/node-cache-manager-fs-hash)

- [node-cache-manager-hazelcast](https://github.com/marudor/node-cache-manager-hazelcast)

- [node-cache-manager-memcached-store](https://github.com/theogravity/node-cache-manager-memcached-store)

- [node-cache-manager-memory-store](https://github.com/theogravity/node-cache-manager-memory-store)

- [node-cache-manager-couchbase](https://github.com/davidepellegatta/node-cache-manager-couchbase)

- [node-cache-manager-sqlite](https://github.com/maxpert/node-cache-manager-sqlite)

- [@resolid/cache-manager-sqlite](https://github.com/huijiewei/cache-manager-sqlite) (uses [better-sqlite3](https://github.com/WiseLibs/better-sqlite3))

## Contribute

If you would like to contribute to the project, please read how to contribute here [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

cache-manager is licensed under the [MIT license](./LICENSE).
