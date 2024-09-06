[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# Cacheable

> Simple Caching Engine using Keyv

[![codecov](https://codecov.io/gh/jaredwray/cacheable/branch/master/graph/badge.svg?token=LDLaqe4PsI)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/cacheable.svg)](https://www.npmjs.com/package/cacheable)
[![npm](https://img.shields.io/npm/v/cacheable)](https://www.npmjs.com/package/cacheable)

`cacheable` is a simple caching engine that uses [Keyv](https://keyv.org) as the storage engine. It is designed to be simple to use and extend. Here are some of the features:

* Simple to use with robust API
* Not bloated with additional modules
* Extendable to your own caching engine
* Scalable and trusted storage engine by Keyv
* Statistics built in by default
* Hooks and Events to extend functionality
* Comprehensive testing and code coverage
* Maintained and supported

## Getting Started

`cacheable` is primarily used as an extension to you caching engine with a robust storage backend [Keyv](https://keyv.org), Memonization, Hooks, Events, and Statistics.

```bash
npm install cacheable
```

## Basic Usage

```javascript
import { Cacheable } from 'cacheable';

const cacheable = new Cacheable();
cacheable.set('key', 'value', 1000);
const value = cacheable.get('key');
```

## Extending Your own Caching Engine

```javascript
import { Cacheable } from 'cacheable';

export class MyCache extends Cacheable {
  constructor() {
	super();
  }
}
```

From here you now how the ability to use the `cacheable` API. You can also extend the API to add your own functionality.

## Storage Adapters and Keyv

To set Keyv as the storage engine, you can do the following:

```javascript
import { Cacheable } from 'cacheable';
import Keyv from 'keyv';

export class MyCache extends Cacheable {
  constructor() {
	super(new Keyv('redis://user:pass@localhost:6379'));
  }
}
```

or you can do it at the property level:

```javascript
import { Cacheable } from 'cacheable';
import Keyv from 'keyv';

export class MyCache extends Cacheable {
  constructor() {
	super();

	this.store = new Keyv('redis://user:pass@localhost:6379');
  }
}
```

## Statistics

To get statistics on your cache, you can do the following:

```javascript
import { Cacheable } from 'cacheable';

export class MyCache extends Cacheable {
  constructor() {
	super();
  }

  async getStats() {
	return this.stats.getReport();
  }
}
```

This will generate the following json object:

```json
{
  "cacheSize": 100,
  "currentSize": 80,
  "hits": 500,
  "misses": 200,
  "hitRate": 0.71,
  "evictions": 50,
  "averageLoadPenalty": 0.05,
  "loadSuccessCount": 700,
  "loadExceptionCount": 10,
  "totalLoadTime": 3500,
  "topHits": [
    {
      "key": "key1",
      "value": "value1",
      "lastAccessed": 1627593600000,
      "accessCount": 50
    },
    {
      "key": "key2",
      "value": "value2",
      "lastAccessed": 1627593600000,
      "accessCount": 45
    }
    // More items...
  ],
  "leastUsed": [
    {
      "key": "key3",
      "value": "value3",
      "lastAccessed": 1627593600000,
      "accessCount": 5
    },
    {
      "key": "key4",
      "value": "value4",
      "lastAccessed": 1627593600000,
      "accessCount": 4
    }
    // More items...
  ]
}
```

* `cacheSize`: The maximum number of items that can be stored in the cache.
* `currentSize`: The current number of items in the cache.
hits: The number of cache hits. A cache hit occurs when the requested data is found in the cache.
* `misses`: The number of cache misses. A cache miss occurs when the requested data is not found in the cache and needs to be loaded.
* `hitRate`: The ratio of cache hits to the total number of cache lookups. This is a measure of the cache's effectiveness.
* `evictions`: The number of items that have been evicted from the cache, typically because the cache is full.
* `averageLoadPenalty`: The average time spent loading new values into the cache, typically measured in milliseconds. This could be calculated as totalLoadTime / (hits + misses).
* `loadSuccessCount`: The number of times cache loading has succeeded.
* `loadExceptionCount`: The number of times cache loading has failed due to exceptions.
* `totalLoadTime`: The total time spent loading new values into the cache, typically measured in milliseconds.

## Hooks and Events

The following hooks are available for you to extend the functionality of `cacheable`:

* `preSet`: This is called before the `set` method is called.
* `postSet`: This is called after the `set` method is called.
* `preSetMany`: This is called before the `setMany` method is called.
* `postSetMany`: This is called after the `setMany` method is called.
* `preGet`: This is called before the `get` method is called.
* `postGet`: This is called after the `get` method is called.
* `preGetMany`: This is called before the `getMany` method is called.
* `postGetMany`: This is called after the `getMany` method is called.

An example of how to use these hooks:

```javascript
import { Cacheable } from 'cacheable';

const cacheable = new Cacheable();
cacheable.hooks.setHook('preSet', (key, value) => {
  console.log(`preSet: ${key} ${value}`);
});
```

The following events are available for you to extend the functionality of `cacheable`:

* `set`: This is called when the `set` method is called.
* `setMany`: This is called when the `setMany` method is called.
* `get`: This is called when the `get` method is called.
* `getMany`: This is called when the `getMany` method is called.
* `clear`: This is called when the `clear` method is called.
* `has`: This is called when the `has` method is called.
* `disconnect`: This is called when the `disconnect` method is called.
* `error`: This is called when an error occurs.

## API

* `set(key, value, ttl?)`: Sets a value in the cache.
* `setMany([{key, value, ttl?}])`: Sets multiple values in the cache.
* `get(key)`: Gets a value from the cache.
* `has(key)`: Checks if a value exists in the cache.
* `getMany([keys])`: Gets multiple values from the cache.
* `delete(key)`: Deletes a value from the cache.
* `clear()`: Clears the cache.
* `disconnect()`: Disconnects from the cache.
* `getStats()`: Gets statistics from the cache.
* `setHook(hook, callback)`: Sets a hook.
* `deleteHook(hook)`: Removes a hook.
* `emitEvent(event, data)`: Emits an event.
* `on(event, callback)`: Listens for an event.
* `removeListener(event, callback)`: Removes a listener.
* `store`: The [Keyv](https://keyv.org) storage engine.

## How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

## License and Copyright
MIT © Jared Wray - [https://github.com/jaredwray/cacheable/blob/main/LICENSE](https://github.com/jaredwray/cacheable/blob/main/LICENSE)