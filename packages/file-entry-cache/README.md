[<img align="center" src="https://cacheable.org/symbol.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# file-entry-cache
> A lightweight cache for file metadata, ideal for processes that work on a specific set of files and only need to reprocess files that have changed since the last run

[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/file-entry-cache.svg)](https://www.npmjs.com/package/file-entry-cache)
[![npm](https://img.shields.io/npm/v/file-entry-cache)](https://www.npmjs.com/package/file-entry-cache)
[![license](https://img.shields.io/github/license/jaredwray/cacheable)](https://github.com/jaredwray/cacheable/blob/main/LICENSE)

# Features

- Lightweight cache for file metadata
- Ideal for processes that work on a specific set of files
- Persists cache to Disk via `reconcile()` or `persistInterval` on `cache` options.
- Uses `checksum` to determine if a file has changed
- Supports `relative` and `absolute` paths - paths are stored exactly as provided
- Portable cache files when using relative paths
- ESM and CommonJS support with Typescript

# Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Changes from v9 to v10](#changes-from-v9-to-v10)
- [Global Default Functions](#global-default-functions)
- [FileEntryCache Options (FileEntryCacheOptions)](#fileentrycache-options-fileentrycacheoptions)
- [API](#api)
- [Get File Descriptor](#get-file-descriptor)
- [Using Checksums to Determine if a File has Changed (useCheckSum)](#using-checksums-to-determine-if-a-file-has-changed-usechecksum)
- [Setting Additional Meta Data](#setting-additional-meta-data)
- [How to Contribute](#how-to-contribute)
- [License and Copyright](#license-and-copyright)

# Installation
```bash
npm install file-entry-cache
```

# Getting Started

```javascript
import fileEntryCache from 'file-entry-cache';
const cache = fileEntryCache.create('cache1');

// Using relative paths
let fileDescriptor = cache.getFileDescriptor('./src/file.txt');
console.log(fileDescriptor.changed); // true as it is the first time
console.log(fileDescriptor.key); // './src/file.txt' (stored as provided)

fileDescriptor = cache.getFileDescriptor('./src/file.txt');
console.log(fileDescriptor.changed); // false as it has not changed

// do something to change the file
fs.writeFileSync('./src/file.txt', 'new data foo bar');

// check if the file has changed
fileDescriptor = cache.getFileDescriptor('./src/file.txt');
console.log(fileDescriptor.changed); // true
```

Save it to Disk and Reconcile files that are no longer found
```javascript
import fileEntryCache from 'file-entry-cache';
const cache = fileEntryCache.create('cache1');
let fileDescriptor = cache.getFileDescriptor('./src/file.txt');
console.log(fileDescriptor.changed); // true as it is the first time
cache.reconcile(); // save the cache to disk and remove files that are no longer found
```

Load the cache from a file:

```javascript
import fileEntryCache from 'file-entry-cache';
const cache = fileEntryCache.createFromFile('/path/to/cache/file');
let fileDescriptor = cache.getFileDescriptor('./src/file.txt');
console.log(fileDescriptor.changed); // false as it has not changed from the saved cache.
```

## Migration Guide from v10 to v11

The main breaking change is the removal of `currentWorkingDirectory`. Here's how to update your code:

**Before (v10):**
```javascript
const cache = new FileEntryCache({
  currentWorkingDirectory: '/project/root'
});
// This would store the key as 'src/file.js'
cache.getFileDescriptor('/project/root/src/file.js');
```

**After (v11):**
```javascript
const cache = new FileEntryCache();
// Now stores the key exactly as provided
cache.getFileDescriptor('./src/file.js');  // Key: './src/file.js'
cache.getFileDescriptor('/project/root/src/file.js'); // Key: '/project/root/src/file.js'
```

If you were using absolute paths with `currentWorkingDirectory`, you'll need to update your code to use relative paths if you want portable cache files.

# Changes from v10 to v11

**BREAKING CHANGES:**
- **Removed `currentWorkingDirectory`** - This option has been completely removed from the API. Paths are now stored exactly as provided (relative or absolute).
- **Path handling changes** - The cache now stores paths exactly as they are provided:
  - Relative paths remain relative in the cache
  - Absolute paths remain absolute in the cache
  - The same file accessed with different path formats will create separate cache entries
- **Renamed method** - `renameAbsolutePathKeys()` is now `renameCacheKeys()` to reflect that it works with any path format
- **Simplified API** - Removed `currentWorkingDirectory` parameter from all methods including `getFileDescriptor()`, `removeEntry()`, and factory functions

These changes make cache files portable when using relative paths, and simplify the API by removing path manipulation logic.

# Changes from v9 to v10

There have been many features added and changes made to the `file-entry-cache` class. Here are the main changes:
- Added `cache` object to the options to allow for more control over the cache
- Added `hashAlgorithm` to the options to allow for different checksum algorithms. Note that if you load from file it most likely will break if the value was something before.
- Migrated to Typescript with ESM and CommonJS support. This allows for better type checking and support for both ESM and CommonJS.
- Once options are passed in they get assigned as properties such as `hashAlgorithm`. For the Cache options they are assigned to `cache` such as `cache.ttl` and `cache.lruSize`.
- Added `cache.persistInterval` to allow for saving the cache to disk at a specific interval. This will save the cache to disk at the interval specified instead of calling `reconsile()` to save. (`off` by default)
- Added `getFileDescriptorsByPath(filePath: string): FileEntryDescriptor[]` to get all the file descriptors that start with the path specified. This is useful when you want to get all the files in a directory or a specific path.
- Using `flat-cache` v6 which is a major update. This allows for better performance and more control over the cache.
- On `FileEntryDescriptor.meta` if using typescript you need to use the `meta.data` to set additional information. This is to allow for better type checking and to avoid conflicts with the `meta` object which was `any`.

# Global Default Functions
- `create(cacheId: string, cacheDirectory?: string, useCheckSum?: boolean)` - Creates a new instance of the `FileEntryCache` class
- `createFromFile(cachePath: string, useCheckSum?: boolean)` - Creates a new instance of the `FileEntryCache` class and loads the cache from a file.

# FileEntryCache Options (FileEntryCacheOptions)
- `useModifiedTime?` - If `true` it will use the modified time to determine if the file has changed. Default is `true`
- `useCheckSum?` - If `true` it will use a checksum to determine if the file has changed. Default is `false`
- `hashAlgorithm?` - The algorithm to use for the checksum. Default is `md5` but can be any algorithm supported by `crypto.createHash`
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

- `constructor(options?: FileEntryCacheOptions)` - Creates a new instance of the `FileEntryCache` class
- `useCheckSum: boolean` - If `true` it will use a checksum to determine if the file has changed. Default is `false`
- `hashAlgorithm: string` - The algorithm to use for the checksum. Default is `md5` but can be any algorithm supported by `crypto.createHash`
- `getHash(buffer: Buffer): string` - Gets the hash of a buffer used for checksums
- `createFileKey(filePath: string): string` - Returns the cache key for the file path (returns the path exactly as provided).
- `deleteCacheFile(): boolean` - Deletes the cache file from disk
- `destroy(): void` - Destroys the cache. This will clear the cache in memory. If using cache persistence it will stop the interval.
- `removeEntry(filePath: string): void` - Removes an entry from the cache using the exact path provided.
- `reconcile(): void` - Saves the cache to disk and removes any files that are no longer found.
- `hasFileChanged(filePath: string): boolean` - Checks if the file has changed. This will return `true` if the file has changed.
- `getFileDescriptor(filePath: string, options?: { useModifiedTime?: boolean, useCheckSum?: boolean }): FileEntryDescriptor` - Gets the file descriptor for the file. Please refer to the entire section on `Get File Descriptor` for more information.
- `normalizeEntries(entries: FileEntryDescriptor[]): FileEntryDescriptor[]` - Normalizes the entries to have the correct paths. This is used when loading the cache from disk.
- `analyzeFiles(files: string[])` will return `AnalyzedFiles` object with `changedFiles`, `notFoundFiles`, and `notChangedFiles` as FileDescriptor arrays.
- `getUpdatedFiles(files: string[])` will return an array of `FileEntryDescriptor` objects that have changed.
- `getFileDescriptorsByPath(filePath: string): FileEntryDescriptor[]` will return an array of `FileEntryDescriptor` objects that starts with the path prefix specified.

# Get File Descriptor

The `getFileDescriptor(filePath: string, options?: { useCheckSum?: boolean, useModifiedTime?: boolean }): FileEntryDescriptor` function is used to get the file descriptor for the file. This function will return a `FileEntryDescriptor` object that has the following properties:

- `key: string` - The cache key for the file. This is exactly the path that was provided (relative or absolute).
- `changed: boolean` - If the file has changed since the last time it was analyzed.
- `notFound: boolean` - If the file was not found.
- `meta: FileEntryMeta` - The meta data for the file. This has the following properties: `size`, `mtime`, `hash`, `data`. Note that `data` is an object that can be used to store additional information.
- `err` - If there was an error analyzing the file.

## Path Handling

The cache stores paths exactly as they are provided:

- **Relative paths** remain relative in the cache
- **Absolute paths** remain absolute in the cache
- The same file accessed with different path formats creates **separate cache entries**

```javascript
const fileEntryCache = new FileEntryCache();

// Using a relative path
const relativeDescriptor = fileEntryCache.getFileDescriptor('./file.txt');
console.log(relativeDescriptor.key); // './file.txt'

// Using an absolute path
const absolutePath = path.resolve('./file.txt');
const absoluteDescriptor = fileEntryCache.getFileDescriptor(absolutePath);
console.log(absoluteDescriptor.key); // '/full/path/to/file.txt'

// These create two separate cache entries even though they refer to the same file
```

This behavior makes cache files portable when using relative paths, as they will work correctly when the project is moved to a different location.

If there is an error when trying to get the file descriptor it will return an ``notFound` and `err` property with the error.

```javascript
const fileEntryCache = new FileEntryCache();
const fileDescriptor = fileEntryCache.getFileDescriptor('no-file');
if (fileDescriptor.err) {
    console.error(fileDescriptor.err);
}

if (fileDescriptor.notFound) {
    console.error('File not found');
}
```

# Using Checksums to Determine if a File has Changed (useCheckSum)

By default the `useCheckSum` is `false`. This means that the `FileEntryCache` will use the `mtime` and `ctime` to determine if the file has changed. If you set `useCheckSum` to `true` it will use a checksum to determine if the file has changed. This is useful when you want to make sure that the file has not changed at all. 

```javascript
const fileEntryCache = new FileEntryCache();
const fileDescriptor = fileEntryCache.getFileDescriptor('file.txt', { useCheckSum: true });
```

You can pass `useCheckSum` in the FileEntryCache options, as a property `.useCheckSum` to make it default for all files, or in the `getFileDescriptor` function. Here is an example where you set it globally but then override it for a specific file:

```javascript
const fileEntryCache = new FileEntryCache({ useCheckSum: true });
const fileDescriptor = fileEntryCache.getFileDescriptor('file.txt', { useCheckSum: false });
``` 

# Setting Additional Meta Data

In the past we have seen people do random values on the `meta` object. This can cause issues with the `meta` object. To avoid this we have `data` which can be anything. 

```javascript 
const fileEntryCache = new FileEntryCache();
const fileDescriptor = fileEntryCache.getFileDescriptor('file.txt');
fileDescriptor.meta.data = { myData: 'myData' }; //anything you want
```
# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)