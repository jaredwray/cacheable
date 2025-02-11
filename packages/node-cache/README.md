[<img align="center" src="https://cacheable.org/symbol.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# Node-Cache

> Simple and Maintained fast Node.js caching

[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/@cacheable/node-cache.svg)](https://www.npmjs.com/package/@cacheable/node-cache)
[![npm](https://img.shields.io/npm/v/@cacheable/node-cache)](https://www.npmjs.com/package/@cacheable/node-cache)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

`@cacheable/node-cache` is compatible with the [node-cache](https://www.npmjs.com/package/node-cache) package with regular maintenance and additional functionality (async/await and storage adapters). The only thing not implemented is the `enableLegacyCallbacks` option and functions. If you need them we are happy to take a PR to add them.

* Fully Compatible with `node-cache` using `{NodeCache}`
* Async/Await functionality with `{NodeCacheStore}`
* Storage Adapters via [Keyv](https://keyv.org) with `{NodeCacheStore}`
* Maintained and Updated Regularly! 🎉

Note: `NodeCache` is ready and available for use. `NodeCacheStore` is in progress and will be available soon. Please do not use it until it is released.

# Table of Contents
* [Getting Started](#getting-started)
* [Basic Usage](#basic-usage)
* [Advanced Usage](#advanced-usage)
* [NodeCacheStore](#nodecachestore)
* [API](#api)
* [How to Contribute](#how-to-contribute)
* [License and Copyright](#license-and-copyright)

# Getting Started

```bash
npm install @cacheable/node-cache --save
```

# Basic Usage

```javascript
import NodeCache from '@cacheable/node-cache';

const cache = new NodeCache();
cache.set('foo', 'bar');
cache.get('foo'); // 'bar'

cache.set('foo', 'bar', 10); // 10 seconds

cache.del('foo'); // true

cache.set('bar', 'baz', '35m'); // 35 minutes using shorthand
```

# NodeCache Not Default Export

```javascript
import {NodeCache} from '@cacheable/node-cache';

const cache = new NodeCache();
cache.set('foo', 'bar');
cache.get('foo'); // 'bar'
```

# Advanced Usage

```javascript
import {NodeStorageCache} from '@cacheable/node-cache';
import {Keyv} from 'keyv';
import {KeyvRedis} from '@keyv/redis';

const storage = new Keyv({store: new KeyvRedis('redis://user:pass@localhost:6379')});
const cache = new NodeStorageCache(storage);

// with storage you have the same functionality as the NodeCache but will be using async/await
await cache.set('foo', 'bar');
await cache.get('foo'); // 'bar'

// if you call getStats() this will now only be for the single instance of the adapter as it is in memory
cache.getStats(); // {hits: 1, misses: 1, keys: 1, ksize: 2, vsize: 3}
```

# NodeCacheStore

The `NodeCacheStore` is a class that extends the `NodeCache` and adds the ability to use storage adapters. This is based on the `cacheable` engine and allows you to do layer 1 and layer 2 caching. The storage adapters are based on the [Keyv](https://keyv.org) package. This allows you to use any of the storage adapters that are available.

```javascript
import {NodeCacheStore} from '@cacheable/node-cache';

const cache = new NodeCacheStore();
cache.set('foo', 'bar');
cache.get('foo'); // 'bar'
```

## NodeCacheStoreOptions

When initializing the cache you can pass in the options below:

```javascript
export type NodeCacheStoreOptions = {
	ttl?: number; // The standard ttl as number in milliseconds for every generated cache element. 0 = unlimited
	primary?: Keyv; // The primary storage adapter
	secondary?: Keyv; // The secondary storage adapter
	maxKeys?: number; // Default is 0 (unlimited). If this is set it will throw and error if you try to set more keys than the max.
	stats?: boolean; // Default is true, if this is set to false it will not track stats
};
```

Note: the `ttl` is now in milliseconds and not seconds like `stdTTL` in `NodeCache`. You can learn more about using shorthand also in the [cacheable documentation](https://github.com/jaredwray/cacheable/blob/main/packages/cacheable/README.md#shorthand-for-time-to-live-ttl). as it is fulling supported. Here is an example:

```javascript
const cache = new NodeCacheStore({ttl: 60000 }); // 1 minute as it defaults to milliseconds
cache.set('foo', 'bar', '1h'); // 1 hour
cache.set('longfoo', 'bar', '1d'); // 1 day
```

## Node Cache Store API

* `set(key: string | number, value: any, ttl?: number): Promise<boolean>` - Set a key value pair with an optional ttl (in milliseconds). Will return true on success. If the ttl is not set it will default to 0 (no ttl)
* `mset(data: Array<NodeCacheItem>): Promise<boolean>` - Set multiple key value pairs at once
* `get<T>(key: string | number): Promise<T>` - Get a value from the cache by key
* `mget(keys: Array<string | number>): Promise<Record<string, unknown>>` - Get multiple values from the cache by keys
* `take<T>(key: string | number): Promise<T>` - Get a value from the cache by key and delete it
* `del(key: string | number): Promise<boolean>` - Delete a key
* `mdel(keys: Array<string | number>): Promise<boolean>` - Delete multiple keys
* `clear(): Promise<void>` - Clear the cache
* `setTtl(key: string | number, ttl: number): Promise<boolean>` - Set the ttl of a key
* `disconnect(): Promise<void>` - Disconnect the storage adapters
* `stats`: `NodeCacheStats` - Get the stats of the cache
* `ttl`: `number` | `string` - The standard ttl as number in seconds for every generated cache element. `< 0` or `undefined` = unlimited
* `primary`: `Keyv` - The primary storage adapter
* `secondary`: `Keyv` - The secondary storage adapter
* `maxKeys`: `number` - If this is set it will throw and error if you try to set more keys than the max

# API

## `constructor(options?: NodeCacheOptions)`

Create a new cache instance. You can pass in options to set the configuration:

```javascript
export type NodeCacheOptions = {
	stdTTL?: number; // The standard ttl as number in seconds for every generated cache element. 0 = unlimited. If string, it will be parsed as shorthand and default to milliseconds if it is a number as a string.
	checkperiod?: number; // Default is 600, 0 means no periodic check
	useClones?: boolean; // Default is true
	deleteOnExpire?: boolean; // Default is true, if false it will keep the key and not delete during an interval check and the value on get() will be undefined
	maxKeys?: number; // Default is -1 (unlimited). If this is set it will throw and error if you try to set more keys than the max.
};
```

When initializing the cache you can pass in the options to set the configuration like the example below where we set the `stdTTL` to 10 seconds and `checkperiod` to 5 seconds.:

```javascript
const cache = new NodeCache({stdTTL: 10, checkperiod: 5});
```

When setting `deleteOnExpire` to `true` it will delete the key when it expires. If you set it to `false` it will keep the key but the value on `get()` will be `undefined`. You can manage the key with `on('expired')` event.

```javascript
const cache = new NodeCache({deleteOnExpire: false});
cache.on('expired', (key, value) => {
	console.log(`Key ${key} has expired with value ${value}`);
});
```

## `.set(key: string | number, value: any, ttl?: number): boolean`

Set a key value pair with an optional ttl (in seconds). Will return true on success. If the ttl is not set it will default to 0 (no ttl).

```javascript
cache.set('foo', 'bar', 10); // true
```

## `.mset(data: Array<NodeCacheItem>): boolean`

Set multiple key value pairs at once. This will take an array of objects with the key, value, and optional ttl.

```javascript
cache.mset([{key: 'foo', value: 'bar', ttl: 10}, {key: 'bar', value: 'baz'}]); // true
```

the `NodeCacheItem` is defined as:

```javascript
export type NodeCacheItem = {
	key: string;
	value: any;
	ttl?: number;
};
```

## `.get(key: string | number): any`

Get a value from the cache by key. If the key does not exist it will return `undefined`.

```javascript
cache.get('foo'); // 'bar'
```

## `mget(keys: Array<string | number>): Record<string, unknown>`

Get multiple values from the cache by keys. This will return an object with the keys and values.

```javascript
const obj = { my: 'value', my2: 'value2' };
const obj2 = { special: 'value3', life: 'value4' };
cache.set('my', obj);
cache.set('my2', obj2);
cache.mget(['my', 'my2']); // { my: { my: 'value', my2: 'value2' }, my2: { special: 'value3', life: 'value4' } }
```

## `take(key: string | number): any`

Get a value from the cache by key and delete it. If the key does not exist it will return `undefined`.

```javascript
cache.set('foo', 'bar');
cache.take('foo'); // 'bar'
cache.get('foo'); // undefined
```

## `del(key: string | number | Array<string | number>): number`

Delete a key from the cache. Will return the number of deleted entries and never fail. You can also pass in an array of keys to delete multiple keys. All examples assume that you have initialized the cache like `const cache = new NodeCache();`.

```javascript
cache.del('foo'); // true
```

passing in an array of keys:

```javascript
cache.del(['foo', 'bar']); // true
```

## `.mdel(keys: Array<string | number>): number`

Delete multiple keys from the cache. Will return the number of deleted entries and never fail.

```javascript
cache.mdel(['foo', 'bar']); // true
```

## `.ttl(key: string | number, ttl?: number): boolean`

Redefine the ttl of a key. Returns true if the key has been found and changed. Otherwise returns false. If the ttl-argument isn't passed the default-TTL will be used.

```javascript
cache.ttl('foo', 10); // true
```

## `getTtl(key: string | number): number | undefined`

Get the ttl expiration from `Date.now()` of a key. If the key does not exist it will return `undefined`.

```javascript
cache.getTtl('foo'); // 1725993344859
```

## `has(key: string | number): boolean`

Check if a key exists in the cache.

```javascript
cache.set('foo', 'bar');
cache.has('foo'); // true
```

## `keys(): Array<string>`

Get all keys from the cache.

```javascript
cache.keys(); // ['foo', 'bar']
```

## `getStats(): NodeCacheStats`

Get the stats of the cache.

```javascript
cache.getStats(); // {hits: 1, misses: 1, keys: 1, ksize: 2, vsize: 3}
```

## `flushAll(): void`

Flush the cache. Will remove all keys and reset the stats.

```javascript
cache.flushAll();
cache.keys(); // []
cache.getStats(); // {hits: 0, misses: 0, keys: 0, ksize: 0, vsize: 0}
```

## `flushStats(): void`

Flush the stats. Will reset the stats but keep the keys.

```javascript
cache.set('foo', 'bar');
cache.flushStats();
cache.getStats(); // {hits: 0, misses: 0, keys: 0, ksize: 0, vsize: 0}
cache.keys(); // ['foo']
```

## `close(): void`

this will stop the interval that is running for the `checkperiod` and `deleteOnExpire` options.

```javascript
cache.close();
```

## `on(event: string, callback: Function): void`

Listen to events. Here are the events that you can listen to:
* `set` - when a key is set and it will pass in the `key` and `value`.
* `expired` - when a key is expired and it will pass in the `key` and `value`.
* `flush` - when the cache is flushed
* `flush_stats` - when the stats are flushed
* `del` - when a key is deleted and it will pass in the `key` and `value`.

```javascript
cache.on('set', (key, value) => {
	console.log(`Key ${key} has been set with value ${value}`);
});
```

# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)