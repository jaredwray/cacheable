[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# Node-Cache

> Simple and Maintained fast Node.js caching

[![codecov](https://codecov.io/gh/jaredwray/cacheable/branch/master/graph/badge.svg?token=LDLaqe4PsI)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/cacheable.svg)](https://www.npmjs.com/package/cacheable)
[![npm](https://img.shields.io/npm/v/cacheable)](https://www.npmjs.com/package/cacheable)

`@cacheable/node-cache` is compatible with the `node-cache` package with regular maintenance and additional functionality (async/await and storage adapters).

* Fully Compatible with `node-cache` using `{NodeCache}`
* Async/Await functionality with `{NodeStorageCache}`
* Storage Adapters via [Keyv](https://keyv.org) with `{NodeStorageCache}`
* Maintained and Updated Regularly! 🎉

## Getting Started

```bash
npm install @cacheable/node-cache --save
```

## Basic Usage

```javascript
import {NodeCache} from '@cacheable/node-cache';

const cache = new NodeCache();
cache.set('foo', 'bar');
cache.get('foo'); // 'bar'
```

## Advanced Usage

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

## API


## How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

## License and Copyright
[MIT © Jared Wray](https://github.com/jaredwray/cacheable/blob/main/LICENSE)