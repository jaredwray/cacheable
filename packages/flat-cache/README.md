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
- Easily Loads the data from disk and into memory
- Uses `ttl` and `lruSize` to manage the cache and persist the data
- Only saves the data to disk if the data has changed even when using `persistInterval` or calling `save()`
- Uses `flatted` to parse and stringify the data by default but can be overridden

# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)