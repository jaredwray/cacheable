[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

> Cacheble Utils

[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/@cacheable/utils.svg)](https://www.npmjs.com/package/@cacheable/utils)
[![npm](https://img.shields.io/npm/v/@cacheable/utils)](https://www.npmjs.com/package/@cacheable/utils)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

`@cacheable/utils` is a collecton of utility functions, helpers, and types for `cacheable` and other caching libraries. It provides a robust set of features to enhance caching capabilities, including:

* Data Types for Caching Items
* Hash Functions for Key Generation
* Coalesce Async for Handling Multiple Promises
* Stats Helpers for Caching Statistics
* Sleep / Delay for Testing and Timing
* Time to Live (TTL) Helpers

# Table of Contents
* [Getting Started](#getting-started)
* [Cacheable Types](#cacheable-types)
* [Coalesce Async](#coalesce-async)
* [Hash Functions](#hash-functions)
* [Shorthand Time Helpers](#shorthand-time-helpers)
* [Sleep Helper](#sleep-helper)
* [Stats Helpers](#stats-helpers)
* [Time to Live (TTL) Helpers](#time-to-live-ttl-helpers)
* [How to Contribute](#how-to-contribute)
* [License and Copyright](#license-and-copyright)

# Getting Started

`cacheable` is primarily used as an extension to your caching engine with a robust storage backend [Keyv](https://keyv.org), Memoization (Wrap), Hooks, Events, and Statistics.

```bash
npm install @cacheable/utils --save
```

# Cacheable Types

The `@cacheable/utils` package provides various types that are used throughout the caching library. These types help in defining the structure of cached items, ensuring type safety and consistency across your caching operations.

```typescript

/**
 * CacheableItem
 * @typedef {Object} CacheableItem
 * @property {string} key - The key of the cacheable item
 * @property {any} value - The value of the cacheable item
 * @property {number|string} [ttl] - Time to Live - If you set a number it is miliseconds, if you set a string it is a human-readable
 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live. If both are
 * undefined then it will not have a time-to-live.
 */
export type CacheableItem = {
	key: string;
	value: any;
	ttl?: number | string;
};

/**
 * CacheableStoreItem
 * @typedef {Object} CacheableStoreItem
 * @property {string} key - The key of the cacheable store item
 * @property {any} value - The value of the cacheable store item
 * @property {number} [expires] - The expiration time in milliseconds since epoch. If not set, the item does not expire.
 */
export type CacheableStoreItem = {
	key: string;
	value: any;
	expires?: number;
};
```

# Coalesce Async

The `coalesceAsync` function is a utility that allows you to handle multiple asynchronous operations efficiently. It was designed by `Douglas Cayers` https://github.com/douglascayers/promise-coalesce. It helps in coalescing multiple promises into a single promise, ensuring that only one operation is executed at a time for the same key.

```typescript
import { coalesceAsync } from '@cacheable/utils';

const fetchData = async (key: string) => {
  // Simulate an asynchronous operation
  return new Promise((resolve) => setTimeout(() => resolve(`Data for ${key}`), 1000));
};

const result = await Promise.all([
	coalesceAsync('my-key', fetchData),
	coalesceAsync('my-key', fetchData),
	coalesceAsync('my-key', fetchData),
]);
console.log(result); // Data for my-key only executed once
```

# Hash Functions

The `@cacheable/utils` package provides hash functions that can be used to generate unique keys for caching operations. These functions are useful for creating consistent and unique identifiers for cached items.

```typescript
import { hash } from '@cacheable/utils';

const key = hash('my-cache-key');
console.log(key); // Unique hash for 'my-cache-key'
```

If you want to get a number hash you can use the `hashToNumber` function:

```typescript
import { hash, hashToNumber } from '@cacheable/utils';

const min = 0;
const max = 10;

const result = hashToNumber({foo: 'bar'}, min, max, HashAlgorithm.DJB2);
console.log(result); // A number between 0 and 10 based on the hash value
```

# Shorthand Time Helpers

The `@cacheable/utils` package provides a shorthand function to convert human-readable time strings into milliseconds. This is useful for setting time-to-live (TTL) values in caching operations.

You can also use the `shorthandToMilliseconds` function:

```typescript
import { shorthandToMilliseconds } from '@cacheable/utils';

const milliseconds = shorthandToMilliseconds('1h');
console.log(milliseconds); // 3600000
```

You can also use the `shorthandToTime` function to get the current date plus the shorthand time:

```typescript
import { shorthandToTime } from '@cacheable/utils';

const currentDate = new Date();
const timeInMs = shorthandToTime('1h', currentDate);
console.log(timeInMs); // Current date + 1 hour in milliseconds since epoch
```

# Sleep Helper

The `sleep` function is a utility that allows you to pause execution for a specified duration. This can be useful in testing scenarios or when you need to introduce delays in your code.

```typescript
import { sleep } from '@cacheable/utils';

await sleep(1000); // Pause for 1 second
console.log('Execution resumed after 1 second');
```

# Stats Helpers

The `@cacheable/utils` package provides statistics helpers that can be used to track and analyze caching operations. These helpers can be used to gather metrics such as hit rates, miss rates, and other performance-related statistics.

```typescript
import { stats } from '@cacheable/utils';

const cacheStats = stats();
cacheStats.incrementHits();
console.log(cacheStats.hits); // Get the hit rate of the cache
```

# Time to Live (TTL) Helpers

The `@cacheable/utils` package provides helpers for managing time-to-live (TTL) values for cached items. 

You can use the `calculateTtlFromExpiration` function to calculate the TTL based on an expiration date:

```typescript
import { calculateTtlFromExpiration } from '@cacheable/utils';

const expirationDate = new Date(Date.now() + 1000 * 60 * 5); // 5 minutes from now
const ttl = calculateTtlFromExpiration(Date.now(), expirationDate);
console.log(ttl); // 300000
```

You can also use `getTtlFromExpires` to get the TTL from an expiration date:

```typescript
import { getTtlFromExpires } from '@cacheable/utils';

const expirationDate = new Date(Date.now() + 1000 * 60 * 5); // 5 minutes from now
const ttl = getTtlFromExpires(expirationDate);
console.log(ttl); // 300000
```

You can use `getCascadingTtl` to get the TTL for cascading cache operations:

```typescript
import { getCascadingTtl } from '@cacheable/utils';
const cacheableTtl = 1000 * 60 * 5; // 5 minutes
const primaryTtl = 1000 * 60 * 2; // 2 minutes
const secondaryTtl = 1000 * 60; // 1 minute
const ttl = getCascadingTtl(cacheableTtl, primaryTtl, secondaryTtl);
```

# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)
