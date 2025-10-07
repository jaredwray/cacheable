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
- Supports `relative` and `absolute` paths with configurable current working directory
- Portable cache files when using relative paths
- ESM and CommonJS support with Typescript

# Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Changes from v10 to v11](#changes-from-v10-to-v11)
- [Changes from v9 to v10](#changes-from-v9-to-v10)
- [Global Default Functions](#global-default-functions)
- [FileEntryCache Options (FileEntryCacheOptions)](#fileentrycache-options-fileentrycacheoptions)
- [API](#api)
- [Get File Descriptor](#get-file-descriptor)
  - [Path Handling and Current Working Directory](#path-handling-and-current-working-directory)
  - [Cache Portability](#cache-portability)
  - [Maximum Portability with Checksums](#maximum-portability-with-checksums)
  - [Handling Project Relocations](#handling-project-relocations)
- [Path Security and Traversal Prevention](#path-security-and-traversal-prevention)
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


# Changes from v10 to v11

**BREAKING CHANGES:**
- **`strictPaths` now defaults to `true`** - Path traversal protection is enabled by default for security. To restore v10 behavior, explicitly set `strictPaths: false`

**NEW FEATURES:**
- **Added `cwd` option** - You can now specify a custom current working directory for resolving relative paths
- **Added `strictPaths` option** - Provides protection against path traversal attacks (enabled by default)
- **Improved cache portability** - When using relative paths with the same `cwd`, cache files are portable across different environments

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
- `create(cacheId: string, cacheDirectory?: string, useCheckSum?: boolean, cwd?: string)` - Creates a new instance of the `FileEntryCache` class
- `createFromFile(cachePath: string, useCheckSum?: boolean, cwd?: string)` - Creates a new instance of the `FileEntryCache` class and loads the cache from a file.

# FileEntryCache Options (FileEntryCacheOptions)
- `useModifiedTime?` - If `true` it will use the modified time to determine if the file has changed. Default is `true`
- `useCheckSum?` - If `true` it will use a checksum to determine if the file has changed. Default is `false`
- `hashAlgorithm?` - The algorithm to use for the checksum. Default is `md5` but can be any algorithm supported by `crypto.createHash`
- `cwd?` - The current working directory for resolving relative paths. Default is `process.cwd()`
- `strictPaths?` - If `true` restricts file access to within `cwd` boundaries, preventing path traversal attacks. Default is `true`
- `logger?` - A logger instance compatible with Pino logger interface for debugging and monitoring. Default is `undefined`
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
- `cwd: string` - The current working directory for resolving relative paths. Default is `process.cwd()`
- `strictPaths: boolean` - If `true` restricts file access to within `cwd` boundaries. Default is `true`
- `logger: ILogger | undefined` - A logger instance for debugging and monitoring cache operations
- `createFileKey(filePath: string): string` - Returns the cache key for the file path (returns the path exactly as provided).
- `deleteCacheFile(): boolean` - Deletes the cache file from disk
- `destroy(): void` - Destroys the cache. This will clear the cache in memory. If using cache persistence it will stop the interval.
- `removeEntry(filePath: string): void` - Removes an entry from the cache.
- `reconcile(): void` - Saves the cache to disk and removes any files that are no longer found.
- `hasFileChanged(filePath: string): boolean` - Checks if the file has changed. This will return `true` if the file has changed.
- `getFileDescriptor(filePath: string, options?: { useModifiedTime?: boolean, useCheckSum?: boolean }): FileEntryDescriptor` - Gets the file descriptor for the file. Please refer to the entire section on `Get File Descriptor` for more information.
- `normalizeEntries(files?: string[]): FileDescriptor[]` - Normalizes the entries. If no files are provided, it will return all cached entries.
- `analyzeFiles(files: string[])` will return `AnalyzedFiles` object with `changedFiles`, `notFoundFiles`, and `notChangedFiles` as FileDescriptor arrays.
- `getUpdatedFiles(files: string[])` will return an array of `FileEntryDescriptor` objects that have changed.
- `getFileDescriptorsByPath(filePath: string): FileEntryDescriptor[]` will return an array of `FileEntryDescriptor` objects that starts with the path prefix specified.
- `getAbsolutePath(filePath: string): string` - Resolves a relative path to absolute using the configured `cwd`. Returns absolute paths unchanged. When `strictPaths` is enabled, throws an error if the path resolves outside `cwd`.
- `getAbsolutePathWithCwd(filePath: string, cwd: string): string` - Resolves a relative path to absolute using a custom working directory. When `strictPaths` is enabled, throws an error if the path resolves outside the provided `cwd`.

# Get File Descriptor

The `getFileDescriptor(filePath: string, options?: { useCheckSum?: boolean, useModifiedTime?: boolean }): FileEntryDescriptor` function is used to get the file descriptor for the file. This function will return a `FileEntryDescriptor` object that has the following properties:

- `key: string` - The cache key for the file. This is exactly the path that was provided (relative or absolute).
- `changed: boolean` - If the file has changed since the last time it was analyzed.
- `notFound: boolean` - If the file was not found.
- `meta: FileEntryMeta` - The meta data for the file. This has the following properties: `size`, `mtime`, `hash`, `data`. Note that `data` is an object that can be used to store additional information.
- `err` - If there was an error analyzing the file.

## Path Handling and Current Working Directory

The cache stores paths exactly as they are provided (relative or absolute). When checking if files have changed, relative paths are resolved using the configured `cwd` (current working directory):

```javascript
// Default: uses process.cwd()
const cache1 = fileEntryCache.create('cache1');

// Custom working directory
const cache2 = fileEntryCache.create('cache2', './cache', false, '/project/root');
// Or with options object
const cache3 = new FileEntryCache({ cwd: '/project/root' });

// The cache key is always the provided path
const descriptor = cache2.getFileDescriptor('./src/file.txt');
console.log(descriptor.key); // './src/file.txt'
// But file operations resolve from: '/project/root/src/file.txt'
```

### Cache Portability

Using relative paths with a consistent `cwd` (defaults to `process.cwd()`) makes cache files portable across different machines and environments. This is especially useful for CI/CD pipelines and team development.

```javascript
// On machine A (project at /home/user/project)
const cacheA = fileEntryCache.create('build-cache', './cache', false, '/home/user/project');
cacheA.getFileDescriptor('./src/index.js'); // Resolves to /home/user/project/src/index.js
cacheA.reconcile();

// On machine B (project at /workspace/project)
const cacheB = fileEntryCache.create('build-cache', './cache', false, '/workspace/project');
cacheB.getFileDescriptor('./src/index.js'); // Resolves to /workspace/project/src/index.js
// Cache hit! File hasn't changed since machine A
```

### Maximum Portability with Checksums

For maximum cache portability across different environments, use checksums (`useCheckSum: true`) along with relative paths and `cwd` which defaults to `process.cwd()`. This ensures that cache validity is determined by file content rather than modification times, which can vary across systems:

```javascript
// Development machine
const devCache = fileEntryCache.create(
    '.buildcache',
    './cache',                 // cache directory
    true                      // Use checksums for content-based comparison
);

// Process files using relative paths
const descriptor = devCache.getFileDescriptor('./src/index.js');
if (descriptor.changed) {
    console.log('Building ./src/index.js...');
    // Build process here
}
devCache.reconcile(); // Save cache

// CI/CD Pipeline or another developer's machine
const ciCache = fileEntryCache.create(
    '.buildcache',
    './node_modules/.cache',
    true,                      // Same checksum setting
    process.cwd()              // Different absolute path, same relative structure
);

// Same relative path works across environments
const descriptor2 = ciCache.getFileDescriptor('./src/index.js');
if (!descriptor2.changed) {
    console.log('Using cached result for ./src/index.js');
    // Skip rebuild - file content unchanged
}
```

### Handling Project Relocations

Cache remains valid even when projects are moved or renamed:

```javascript
// Original location: /projects/my-app
const cache1 = fileEntryCache.create('.cache', './cache', true, '/projects/my-app');
cache1.getFileDescriptor('./src/app.js');
cache1.reconcile();

// After moving project to: /archived/2024/my-app
const cache2 = fileEntryCache.create('.cache', './cache', true, '/archived/2024/my-app');
cache2.getFileDescriptor('./src/app.js'); // Still finds cached entry!
// Cache valid as long as relative structure unchanged
```

If there is an error when trying to get the file descriptor it will return a `notFound` and `err` property with the error.

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

# Path Security and Traversal Prevention

The `strictPaths` option provides security against path traversal attacks by restricting file access to within the configured `cwd` boundaries. **This is enabled by default (since v11)** to ensure secure defaults when processing untrusted input or when running in security-sensitive environments.

## Basic Usage

```javascript
// strictPaths is enabled by default for security
const cache = new FileEntryCache({
    cwd: '/project/root'
});

// This will work - file is within cwd
const descriptor = cache.getFileDescriptor('./src/index.js');

// This will throw an error - attempts to access parent directory
try {
    cache.getFileDescriptor('../../../etc/passwd');
} catch (error) {
    console.error(error); // Path traversal attempt blocked
}

// To allow parent directory access (not recommended for untrusted input)
const unsafeCache = new FileEntryCache({
    cwd: '/project/root',
    strictPaths: false  // Explicitly disable protection
});
```

## Security Features

When `strictPaths` is enabled:
- **Path Traversal Prevention**: Blocks attempts to access files outside the working directory using `../` sequences
- **Null Byte Protection**: Automatically removes null bytes from paths to prevent injection attacks
- **Path Normalization**: Cleans and normalizes paths to prevent bypass attempts

## Use Cases

### Build Tools with Untrusted Input
```javascript
// Secure build tool configuration
const cache = fileEntryCache.create(
    '.buildcache',
    './cache',
    true,  // useCheckSum
    process.cwd()
);

// Enable strict path checking for security
cache.strictPaths = true;

// Process user-provided file paths safely
function processUserFile(userProvidedPath) {
    try {
        const descriptor = cache.getFileDescriptor(userProvidedPath);
        // Safe to process - file is within boundaries
        return descriptor;
    } catch (error) {
        if (error.message.includes('Path traversal attempt blocked')) {
            console.warn('Security: Blocked access to:', userProvidedPath);
            return null;
        }
        throw error;
    }
}
```

### CI/CD Environments
```javascript
// Strict security for CI/CD pipelines
const cache = new FileEntryCache({
    cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
    strictPaths: true,  // Prevent access outside workspace
    useCheckSum: true   // Content-based validation
});

// All file operations are now restricted to the workspace
cache.getFileDescriptor('./src/app.js');  // ✓ Allowed
cache.getFileDescriptor('/etc/passwd');   // ✗ Blocked (absolute path outside cwd)
cache.getFileDescriptor('../../../root'); // ✗ Blocked (path traversal)
```

### Dynamic Security Control
```javascript
const cache = new FileEntryCache({ cwd: '/safe/directory' });

// Start with relaxed mode for trusted operations
cache.strictPaths = false;
processInternalFiles();

// Enable strict mode for untrusted input
cache.strictPaths = true;
processUserUploadedPaths();

// Return to relaxed mode if needed
cache.strictPaths = false;
```

## Default Behavior

**As of v11, `strictPaths` is enabled by default** to provide secure defaults. This means:
- Path traversal attempts using `../` are blocked
- File access is restricted to within the configured `cwd`
- Null bytes in paths are automatically sanitized

### Migrating from v10 or Earlier

If you're upgrading from v10 or earlier and need to maintain the previous behavior (for example, if your code legitimately accesses parent directories), you can explicitly disable strict paths:

```javascript
const cache = new FileEntryCache({
    cwd: process.cwd(),
    strictPaths: false  // Restore v10 behavior
});
```

However, we strongly recommend keeping `strictPaths: true` and adjusting your code to work within the security boundaries, especially when processing any untrusted input.

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

# Logger Support

The `FileEntryCache` supports logging through a Pino-compatible logger interface. This is useful for debugging and monitoring cache operations in production environments.

## Logger Interface

The logger must implement the following interface:

```typescript
interface ILogger {
  level?: string;
  trace: (message: string | object, ...args: unknown[]) => void;
  debug: (message: string | object, ...args: unknown[]) => void;
  info: (message: string | object, ...args: unknown[]) => void;
  warn: (message: string | object, ...args: unknown[]) => void;
  error: (message: string | object, ...args: unknown[]) => void;
  fatal: (message: string | object, ...args: unknown[]) => void;
}
```

## Using Pino Logger

You can pass a Pino logger instance to the `FileEntryCache` constructor or set it via the `logger` property:

```javascript
import pino from 'pino';
import fileEntryCache from 'file-entry-cache';

// Create a Pino logger
const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Pass logger in constructor
const cache = new fileEntryCache.FileEntryCache({
  logger,
  cacheId: 'my-cache'
});

// Or set it after creation
cache.logger = logger;

// Now all cache operations will be logged
const descriptor = cache.getFileDescriptor('./src/file.txt');
```

## Log Levels

The logger will output different levels of information:

- **trace**: Detailed internal operations (key creation, cached meta lookup, file stats)
- **debug**: Method entry, checksum settings, change detection, file status
- **info**: Important state changes (file has changed)
- **error**: File read errors and exceptions

## Example with Custom Log Levels

```javascript
import pino from 'pino';
import { FileEntryCache } from 'file-entry-cache';

// Create logger with specific level
const logger = pino({ level: 'info' });

const cache = new FileEntryCache({
  logger,
  useCheckSum: true
});

// This will log at info level when files change
const files = ['./src/index.js', './src/utils.js'];
files.forEach(file => {
  const descriptor = cache.getFileDescriptor(file);
  if (descriptor.changed) {
    console.log(`Processing changed file: ${file}`);
  }
});

cache.reconcile();
```

## Debugging Cache Operations

For detailed debugging, set the logger level to `debug` or `trace`:

```javascript
import pino from 'pino';
import { FileEntryCache } from 'file-entry-cache';

const logger = pino({
  level: 'trace',
  transport: {
    target: 'pino-pretty'
  }
});

const cache = new FileEntryCache({
  logger,
  useCheckSum: true,
  cwd: '/project/root'
});

// Will log detailed information about:
// - File path resolution
// - Cache key creation
// - Cached metadata lookup
// - File stats reading
// - Hash calculation (if using checksums)
// - Change detection logic
const descriptor = cache.getFileDescriptor('./src/app.js');
```

# How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

# License and Copyright
[MIT © Jared Wray](./LICENSE)