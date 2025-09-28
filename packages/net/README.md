[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

> High Performance Network Caching for Node.js with fetch, request, http 1.1, and http 2 support

[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/@cacheable/net.svg)](https://www.npmjs.com/package/@cacheable/net)
[![npm](https://img.shields.io/npm/v/@cacheable/net.svg)](https://www.npmjs.com/package/@cacheable/net)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)


Features:
* `fetch` from [undici](https://github.com/nodejs/undici) cache enabled via `cacheable`
* `fetch` quick helpers such as `get`, `post`, `put`, and `delete` for easier development
* `request` from [undici](https://github.com/nodejs/undici) cache enabled via `cacheable`
* HTTP/1.1 and HTTP/2 caching support via Node.js `http` and `https` modules
* [RFC 7234](http://httpwg.org/specs/rfc7234.html) compliant HTTP caching for native Node.js HTTP/HTTPS requests
* Drop in replacement for `http` `https`, `fetch` modules with caching enabled
* DNS caching for `dns.lookup` and `dns.resolve` methods via `cacheable`
* WHOIS caching for `whois.lookup` method via `cacheable`
* Advanced key generation via built in hashing and custom key generation functions
* Benchmarks for performance comparison
* All the features of [cacheable](https://npmjs.com/package/cacheable) - layered caching, LRU, expiration, hooks, backed by Keyv, and more!
* Highly Tested and Maintained on a regular basis with a focus on performance and reliability

# Table of Contents
* [Getting Started](#getting-started)
* [How to Contribute](#how-to-contribute)
* [License and Copyright](#license-and-copyright)

# Getting Started

```bash
npm install @cacheable/net
```

## Basic Usage

```javascript
import { CacheableNet } from '@cacheable/net';

const net = new CacheableNet();

// Simple GET request with caching
const response = await net.get('https://api.example.com/data');
console.log(response.data);

// POST request with data
const result = await net.post('https://api.example.com/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// Using fetch directly with caching
const fetchResponse = await net.fetch('https://api.example.com/data', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

## Custom Serialization

You can provide custom `stringify` and `parse` functions for handling data serialization. This is particularly useful when working with complex data types that JSON doesn't natively support:

```javascript
import { CacheableNet } from '@cacheable/net';
import superjson from 'superjson';

// Using superjson for enhanced serialization
// Supports Dates, BigInt, RegExp, Set, Map, Error and more
const net = new CacheableNet({
  stringify: (value) => superjson.stringify(value),
  parse: (text) => superjson.parse(text)
});

// Now you can work with complex data types
const response = await net.post('https://api.example.com/data', {
  timestamp: new Date(),
  userId: BigInt(12345),
  pattern: /[a-z]+/gi,
  metadata: new Map([['key', 'value']]),
  tags: new Set(['important', 'urgent'])
});

// Or provide per-request custom serialization
const result = await net.get('https://api.example.com/data', {
  parse: (text) => {
    // Custom parsing with superjson for this request only
    return superjson.parse(text);
  }
});
```

## API Reference

### CacheableNet Class

The main class that provides cached network operations.

#### Constructor Options

```typescript
interface CacheableNetOptions {
  cache?: Cacheable | CacheableOptions;  // Cacheable instance or options
  httpCachePolicy?: boolean;                 // Enable HTTP cache semantics (default: true)
  stringify?: (value: unknown) => string; // Custom JSON stringifier (default: JSON.stringify)
  parse?: (value: string) => unknown;     // Custom JSON parser (default: JSON.parse)
```

#### Methods

All methods accept request options of type `FetchOptions` (excluding the `cache` property which is managed internally):

- **fetch(url: string, options?: FetchOptions)**: Fetch with caching support
- **get(url: string, options?: NetFetchOptions)**: GET request helper with caching control
- **post(url: string, data?: unknown, options?: NetFetchOptions)**: POST request helper with caching control
- **put(url: string, data?: unknown, options?: NetFetchOptions)**: PUT request helper with caching control
- **patch(url: string, data?: unknown, options?: NetFetchOptions)**: PATCH request helper with caching control
- **delete(url: string, data?: unknown, options?: NetFetchOptions)**: DELETE request helper with caching control
- **head(url: string, options?: NetFetchOptions)**: HEAD request helper with caching control

The `FetchOptions` type extends the standard fetch `RequestInit` options with additional caching controls:

```typescript
type FetchOptions = Omit<RequestInit, 'cache'> & {
  cache?: Cacheable;          // Optional cache instance (if not provided, no caching)
  httpCachePolicy?: boolean;     // Override instance-level HTTP cache setting
};
```

The `NetFetchOptions` type (used by `get()` and `head()` methods) provides additional control:

```typescript
type NetFetchOptions = {
  caching?: boolean;          // Enable/disable caching for this request
  stringify?: (value: unknown) => string;  // Custom JSON stringifier
  parse?: (value: string) => unknown;      // Custom JSON parser
} & Omit<FetchOptions, 'method' | 'cache'>;
```

**Note**: When using the CacheableNet methods, you don't need to provide the `cache` property as it's automatically injected from the instance.


# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)
