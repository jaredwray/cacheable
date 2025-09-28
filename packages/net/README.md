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

## API Reference

### CacheableNet Class

The main class that provides cached network operations.

#### Constructor Options

```typescript
interface CacheableNetOptions {
  cache?: Cacheable | CacheableOptions;  // Cacheable instance or options
  useHttpCache?: boolean;                 // Enable HTTP cache semantics (default: true)
}
```

#### Methods

All methods accept request options of type `FetchOptions` (excluding the `cache` property which is managed internally):

- **fetch(url: string, options?: FetchOptions)**: Fetch with caching support
- **get(url: string, options?: FetchOptions)**: GET request helper
- **post(url: string, data?: unknown, options?: FetchOptions)**: POST request helper
- **put(url: string, data?: unknown, options?: FetchOptions)**: PUT request helper
- **patch(url: string, data?: unknown, options?: FetchOptions)**: PATCH request helper
- **delete(url: string, data?: unknown, options?: FetchOptions)**: DELETE request helper
- **head(url: string, options?: FetchOptions)**: HEAD request helper

The `FetchOptions` type extends the standard fetch `RequestInit` options with additional caching controls:

```typescript
type FetchOptions = Omit<RequestInit, 'cache'> & {
  cache: Cacheable;           // Required internally, provided by CacheableNet
  useHttpCache?: boolean;     // Override instance-level HTTP cache setting
};
```

**Note**: When using the CacheableNet methods, you don't need to provide the `cache` property as it's automatically injected from the instance.


# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)
