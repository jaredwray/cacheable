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
* Resilient to failures with try/catch
* Hooks and Events to extend functionality
* Comprehensive testing and code coverage
* Tiered Caching with BASE and ACID modes
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
  options = {
    stores: [new Keyv('redis://user:pass@localhost:6379')]
  };
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

	this.stores[0] = new Keyv('redis://user:pass@localhost:6379'); //set redis instead of in-memory
  }
}
```

## Hooks and Events

The following hooks are available for you to extend the functionality of `cacheable` via `CacheableHooks` enum:

* `BEFORE_SET`: This is called before the `set()` method is called.
* `AFTER_SET`: This is called after the `set()` method is called.
* `BEFORE_SET_MANY`: This is called before the `setMany()` method is called.
* `AFTER_SET_MANY`: This is called after the `setMany()` method is called.
* `BEFORE_GET`: This is called before the `get()` method is called.
* `AFTER_GET`: This is called after the `get()` method is called.
* `BEFORE_GET_MANY`: This is called before the `getMany()` method is called.
* `AFTER_GET_MANY`: This is called after the `getMany()` method is called.

An example of how to use these hooks:

```javascript
import { Cacheable, CacheableHooks } from 'cacheable';

const cacheable = new Cacheable();
cacheable.onHook(CacheableHooks.BEFORE_SET, (data) => {
  console.log(`before set: ${data.key} ${data.value}`);
});
```

## API

* `set(key, value, ttl? | [{string, string, ttl?}])`: Sets a value in the cache.
* `setMany([{key, value, ttl?}])`: Sets multiple values in the cache.
* `get(key)`: Gets a value from the cache.
* `has(key | [key])`: Checks if a value exists in the cache.
* `hasMany([keys])`: Checks if multiple values exist in the cache.
* `getMany([keys])`: Gets multiple values from the cache.
* `delete(key | [key])`: Deletes a value from the cache.
* `clear()`: Clears the cache stores.
* `wrap(function, options)`: Wraps a function in a cache.
* `disconnect()`: Disconnects from the cache stores.
* `onHook(hook, callback)`: Sets a hook.
* `removeHook(hook)`: Removes a hook.
* `on(event, callback)`: Listens for an event.
* `removeListener(event, callback)`: Removes a listener.
* `stores`: Array of Keyv stores. The top store is the primary store.

## How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

## License and Copyright
[MIT © Jared Wray](https://github.com/jaredwray/cacheable/blob/main/LICENSE)