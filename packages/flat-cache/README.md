[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# flat-cache
> A simple key/value storage using files to persist the data

[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/flat-cache.svg)](https://www.npmjs.com/package/flat-cache)
[![npm](https://img.shields.io/npm/v/flat-cache)](https://www.npmjs.com/package/flat-cache)
[![GitHub](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

# Features
- A simple key/value storage using files to persist the data
- Uses a in-memory cache (via `CacheableMemory`) as the primary storage and then persists the data to disk
- Automatically saves the data to disk via `persistInterval` setting. Off By Default
- Easily Loads the data from disk and into memory with `load` or `loadFile`
- Uses `ttl` and `lruSize` to manage the cache and persist the data
- Only saves the data to disk if the data has changed even when using `persistInterval` or calling `save()`
- Uses `flatted` to parse and stringify the data by default but can be overridden using `parse` and `stringify` in options

# Table of Contents
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Breaking Changes from v5 to v6](#breaking-changes-from-v5-to-v6)
- [Global Functions](#global-functions)
- [FlatCache Options (FlatCacheOptions)](#flatcache-options-flatcacheoptions)
- [API](#api)
- [Events (FlatCacheEvents)](#events-flatcacheevents)
- [Parse and Stringify for File Caching](#parse-and-stringify-for-file-caching)
- [How to Contribute](#how-to-contribute)
- [License and Copyright](#license-and-copyright)

# Installation
```bash
npm install flat-cache
```

# Getting Started
```javascript
import { FlatCache } from 'flat-cache';
const cache = new FlatCache();
cache.setKey('key', 'value');
cache.save(); // Saves the data to disk
```

lets add it with `ttl`, `lruSize`, and `persistInterval`
```javascript
import { FlatCache } from 'flat-cache';
const cache = new FlatCache({
  ttl: 60 * 60 * 1000 , // 1 hour
  lruSize: 10000, // 10,000 items
  expirationInterval: 5 * 1000 * 60, // 5 minutes
  persistInterval: 5 * 1000 * 60, // 5 minutes
});
cache.setKey('key', 'value');
```

This will save the data to disk every 5 minutes and will remove any data that has not been accessed in 1 hour or if the cache has more than 10,000 items. The `expirationInterval` will check every 5 minutes for expired items and evict them. This is replacement to the `save()` method with a `prune` option as it is no longer needed due to the fact that the in-memory cache handles pruning by `ttl` expiration or `lruSize` which will keep the most recent there.

here is an example doing load from already existing persisted cache

```javascript
import { load } from 'flat-cache';
const cache = load('cache1', './cacheAltDirectory');
```

This will load the cache from the `./cacheAltDirectory` directory with the `cache1` id. If it doesnt exist it will not throw an error but will just return an empty cache.

# Breaking Changes from v5 to v6

There have been many features added and changes made to the `FlatCache` class. Here are the main changes:
- `FlatCache` is now a class and not a function which you can create instances of or using legacy method `load`, `loadFile`, or `create`
- `FlatCache` now uses `CacheableMemory` as the primary storage and then persists the data to disk
- `FlatCache` now uses `ttl` and `lruSize` to manage the cache and persist the data
- `FlatCache` now uses `expirationInterval` to check for expired items in the cache. If it is not set it will do a lazy check on `get` or `getKey`
- `getKey` still exists but is now is an alias to `get` and will be removed in the future
- `setKey` still exists but is now is an alias to `set` and will be removed in the future
- `removeKey` still exists but is now is an alias to `delete` and will be removed in the future

Here is an example of the legacy method `load`:
```javascript
const flatCache = require('flat-cache');
// loads the cache, if one does not exists for the given
// Id a new one will be prepared to be created
const cache = flatCache.load('cacheId');
```

Now you can use the `load` method and ES6 imports:
```javascript
import { FlatCache } from 'flat-cache';
const cache = new FlatCache();
cache.load('cacheId');
```
If you do not specify a `cacheId` it will default to what was set in `FlatCacheOptions` or the default property `cacheId` of `cache1` and default `cacheDir` of `./cache`.

If you want to create a new cache and load from disk if it exists you can use the `create` method:
```javascript
import { create } from 'flat-cache';
const cache = create({ cacheId: 'myCacheId', cacheDir: './mycache', ttl: 60 * 60 * 1000 });
```

# Global Functions

In version 6 we attempted to keep as much as the functionality as possible which includes these functions:

- `create(options?: FlatCacheOptions)` - Creates a new cache and will load the data from disk if it exists
- `createFromFile(filePath, options?: FlatCacheOptions)` - Creates a new cache from a file
- `clearByCacheId(cacheId: string, cacheDir?: string)` - Clears the cache by the cacheId
- `clearAll(cacheDirectory?: string)` - Clears all the caches


# FlatCache Options (FlatCacheOptions)
- `ttl?` - The time to live for the cache in milliseconds. Default is `0` which means no expiration
- `lruSize?` - The number of items to keep in the cache. Default is `0` which means no limit
- `useClone?` - If `true` it will clone the data before returning it. Default is `false`
- `expirationInterval?` - The interval to check for expired items in the cache. Default is `0` which means no expiration
- `persistInterval?` - The interval to save the data to disk. Default is `0` which means no persistence
- `cacheDir?` - The directory to save the cache files. Default is `./cache`
- `cacheId?` - The id of the cache. Default is `cache1`
- `parse?` - The function to parse the data. Default is `flatted.parse`
- `stringify?` - The function to stringify the data. Default is `flatted.stringify`

# API

- `cache` - The in-memory cache as a `CacheableMemory` instance
- `cacheDir` - The directory to save the cache files
- `cacheId` - The id of the cache
- `cacheFilePath` - The full path to the cache file
- `cacheDirPath` - The full path to the cache directory
- `persistInterval` - The interval to save the data to disk
- `changesSinceLastSave` - If there have been changes since the last save
- `load(cacheId: string, cacheDir?: string)` - Loads the data from disk
- `loadFile(pathToFile: string)` - Loads the data from disk
- `all()` - Gets all the data in the cache
- `items()` - Gets all the items in the cache
- `keys()` - Gets all the keys in the cache
- `setKey(key: string, value: any, ttl?: string | number)` - (legacy) Sets the key/value pair in the cache
- `set(key: string, value: any, ttl?: string | number)` - Sets the key/value pair in the cache
- `getKey<T>(key: string)` - Gets the value for the key or the default value
- `get<T>(key: string)` - Gets the value for the key or the default value
- `removeKey(key: string)` - Removes the key from the cache
- `delete(key: string)` - Removes the key from the cache
- `clear()` - Clears the cache
- `save(force? boolean)` - Saves the data to disk. If `force` is `true` it will save even if `changesSinceLastSave` is `false`
- `destroy()` - Destroys the cache and remove files

# Events (FlatCacheEvents)

Events have been added since v6 to allow for more control and visibility into the cache. Here are the events that are available:

- `on(event: 'save', listener: () => void)` - Emitted when the cache is saved
- `on(event: 'load', listener: () => void)` - Emitted when the cache is loaded
- `on(event: 'delete', listener: (key: string) => void)` - Emitted when the cache is changed
- `on(event: 'clear', listener: () => void)` - Emitted when the cache is cleared
- `on(event: 'destroy', listener: () => void)` - Emitted when the cache is destroyed
- `on(event: 'error', listener: (error: Error) => void)` - Emitted when there is an error

Here is an example of how to use the `error` events:

```javascript
import { FlatCache, FlatCacheEvents } from 'flat-cache';
const cache = new FlatCache();
cache.on(FlatCacheEvents.error, (error) => {
  console.error(error);
});
```

`FlatCacheEvents` is an enum that contains the event names for the `on` method. You do not have to use it but makes it easier to know what events are available.

# Parse and Stringify for File Caching

By default `flat-cache` uses `flatted` to parse and stringify the data. This is to allow for more complex data structures to be saved to disk. If you want to override this you can pass in your own `parse` and `stringify` functions. Here is an example:

```javascript
import { FlatCache } from 'flat-cache';
const cache = new FlatCache({
  parse: JSON.parse,
  stringify: JSON.stringify,
});
```

This will use `JSON.parse` and `JSON.stringify` to parse and stringify the data. This is useful if you want to use a different library or have a custom way of parsing and stringifying the data.

**NOTE: This could cause issues if you are trying to load data that was saved with a different parser or stringifier.** 

# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)