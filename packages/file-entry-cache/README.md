[<img align="center" src="https://cacheable.org/symbol.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# file-entry-cache
> A lightweight cache for file metadata, ideal for processes that work on a specific set of files and only need to reprocess files that have changed since the last run

[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/flat-cache.svg)](https://www.npmjs.com/package/flat-cache)
[![npm](https://img.shields.io/npm/v/flat-cache)](https://www.npmjs.com/package/flat-cache)
[![GitHub](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

# Features


# Table of Contents


# Installation
```bash
npm install file-entry-cache
```

# Getting Started


# Changes from v9 to v10

There have been many features added and changes made to the `file-entry-cache` class. Here are the main changes:



# Global Functions


# FileEntryCache Options (FileEntryCacheOptions)
- `currentWorkingDirectory?` - The current working directory. Used when resolving relative paths.
- `useCheckSum?` - If `true` it will use a checksum to determine if the file has changed. Default is `false`
- `cache.ttl?` - The time to live for the cache in milliseconds. Default is `0` which means no expiration
- `cache.lruSize?` - The number of items to keep in the cache. Default is `0` which means no limit
- `cache.useClone?` - If `true` it will clone the data before returning it. Default is `false`
- `cache.expirationInterval?` - The interval to check for expired items in the cache. Default is `0` which means no expiration
- `cache.persistInterval?` - The interval to save the data to disk. Default is `0` which means no persistence
- `cache.cacheDir?` - The directory to save the cache files. Default is `./cache`
- `cache.cacheId?` - The id of the cache. Default is `cache1`
- `cache.parse?` - The function to parse the data. Default is `flatted.parse`
- `cache.stringify?` - The function to stringify the data. Default is `flatted.stringify`

# API



# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)