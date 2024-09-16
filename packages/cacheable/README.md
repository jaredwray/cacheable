[<img align="center" src="https://cacheable.org/logo.svg" alt="Cacheable" />](https://github.com/jaredwray/cacheable)

# Cacheable

> Simple Caching Engine using Keyv

[![codecov](https://codecov.io/gh/jaredwray/cacheable/graph/badge.svg?token=lWZ9OBQ7GM)](https://codecov.io/gh/jaredwray/cacheable)
[![tests](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml/badge.svg)](https://github.com/jaredwray/cacheable/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/dm/cacheable.svg)](https://www.npmjs.com/package/cacheable)
[![npm](https://img.shields.io/npm/v/cacheable)](https://www.npmjs.com/package/cacheable)

`cacheable` is a high performance layer 1 / layer 2 caching engine that is focused on distributed caching with enterprise features such as `CacheSync`. It is built on top of the robust storage engine [Keyv](https://keyv.org) and provides a simple API to cache and retrieve data.

* Simple to use with robust API
* Not bloated with additional modules
* Extendable to your own caching engine
* Scalable and trusted storage engine by Keyv
* Resilient to failures with try/catch and offline
* Hooks and Events to extend functionality
* Comprehensive testing and code coverage
* Distributed Caching Sync via Pub/Sub (coming soon)
* ESM and CommonJS support with TypeScript
* Maintained and supported regularly

## Getting Started

`cacheable` is primarily used as an extension to you caching engine with a robust storage backend [Keyv](https://keyv.org), Memonization, Hooks, Events, and Statistics.

```bash
npm install cacheable
```

## Basic Usage

```javascript
import { Cacheable } from 'cacheable';

const cacheable = new Cacheable();
await cacheable.set('key', 'value', 1000);
const value = await cacheable.get('key');
```

This is a basic example where you are only using the in-memory storage engine. To enable layer 1 and layer 2 caching you can use the `secondary` property in the options:

```javascript
import { Cacheable } from 'cacheable';
import KeyvRedis from '@keyv/redis';

const secondary = new KeyvRedis('redis://user:pass@localhost:6379');
const cache = new Cacheable({secondary});
``` 

In this example, the primary store we will use `lru-cache` and the secondary store is Redis. You can also set multiple stores in the options:

```javascript
import { Cacheable } from 'cacheable';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';
import { LRUCache } from 'lru-cache'

const primary = new Keyv({store: new LRUCache()});
const secondary = new KeyvRedis('redis://user:pass@localhost:6379');
const cache = new Cacheable({primary, secondary});
```

This is a more advanced example and not needed for most use cases.

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

## Storage Tiering and Caching

`cacheable` is built as a layer 1 and layer 2 caching engine by default. The purpose is to have your layer 1 be fast and your layer 2 be more persistent. The primary store is the layer 1 cache and the secondary store is the layer 2 cache. By adding the secondary store you are enabling layer 2 caching. By default the operations are blocking but fault tolerant:

* `Setting Data`: Sets the value in the primary store and then the secondary store.
* `Getting Data`: Gets the value from the primary if the value does not exist it will get it from the secondary store and set it in the primary store.
* `Deleting Data`: Deletes the value from the primary store and secondary store at the same time waiting for both to respond.
* `Clearing Data`: Clears the primary store and secondary store at the same time waiting for both to respond.

## Non-Blocking Operations

If you want your layer 2 (secondary) store to be non-blocking you can set the `nonBlocking` property to `true` in the options. This will make the secondary store non-blocking and will not wait for the secondary store to respond on `setting data`, `deleting data`, or `clearing data`. This is useful if you want to have a faster response time and not wait for the secondary store to respond.

```javascript
import { Cacheable } from 'cacheable';
import {KeyvRedis} from '@keyv/redis';

const secondary = new KeyvRedis('redis://user:pass@localhost:6379');
const cache = new Cacheable({secondary, nonBlocking: true});
```

## CacheSync - Distributed Updates

`cacheable` has a feature called `CacheSync` that is coming soon. This feature will allow you to have distributed caching with Pub/Sub. This will allow you to have multiple instances of `cacheable` running and when a value is set, deleted, or cleared it will update all instances of `cacheable` with the same value. Current plan is to support the following:

* [Google Pub/Sub](https://cloud.google.com/pubsub)
* [AWS SQS](https://aws.amazon.com/sqs)
* [RabbitMQ](https://www.rabbitmq.com)
* [Nats](https://nats.io)
* [Azure Service Bus](https://azure.microsoft.com/en-us/services/service-bus)
* [Redis Pub/Sub](https://redis.io/topics/pubsub)

This feature should be live by end of year. 

## Cacheable Options

The following options are available for you to configure `cacheable`:

* `primary`: The primary store for the cache (layer 1) defaults to in-memory by Keyv.
* `secondary`: The secondary store for the cache (layer 2) usually a persistent cache by Keyv.
* `nonBlocking`: If the secondary store is non-blocking. Default is `false`.
* `stats`: To enable statistics for this instance. Default is `false`.

## Cacheable Statistics (Instance Only)

If you want to enable statistics for your instance you can set the `.stats.enabled` property to `true` in the options. This will enable statistics for your instance and you can get the statistics by calling the `stats` property. Here are the following property statistics:

* `hits`: The number of hits in the cache.
* `misses`: The number of misses in the cache.
* `sets`: The number of sets in the cache.
* `deletes`: The number of deletes in the cache.
* `clears`: The number of clears in the cache.
* `errors`: The number of errors in the cache.
* `count`: The number of keys in the cache.
* `vsize`: The estimated byte size of the values in the cache.
* `ksize`: The estimated byte size of the keys in the cache.

You can clear / reset the stats by calling the `.stats.reset()` method.

_This does not enable statistics for your layer 2 cache as that is a distributed cache_.

## API

* `set(key, value, ttl? | [{string, string, ttl?}])`: Sets a value in the cache.
* `setMany([{key, value, ttl?}])`: Sets multiple values in the cache.
* `get(key | [keys])`: Gets a value from the cache.
* `getMany([keys])`: Gets multiple values from the cache.
* `has(key | [key])`: Checks if a value exists in the cache.
* `hasMany([keys])`: Checks if multiple values exist in the cache.
* `take(key)`: Takes a value from the cache and deletes it.
* `takeMany([keys])`: Takes multiple values from the cache and deletes them.
* `delete(key | [key])`: Deletes a value from the cache.
* `deleteMany([keys])`: Deletes multiple values from the cache.
* `clear()`: Clears the cache stores. Be careful with this as it will clear both layer 1 and layer 2.
* `wrap(function, options)`: Wraps a function in a cache. (coming soon)
* `disconnect()`: Disconnects from the cache stores.
* `onHook(hook, callback)`: Sets a hook.
* `removeHook(hook)`: Removes a hook.
* `on(event, callback)`: Listens for an event.
* `removeListener(event, callback)`: Removes a listener.
* `primary`: The primary store for the cache (layer 1) defaults to in-memory by Keyv.
* `secondary`: The secondary store for the cache (layer 2) usually a persistent cache by Keyv.
* `nonBlocking`: If the secondary store is non-blocking. Default is `false`.
* `stats`: The statistics for this instance which includes `hits`, `misses`, `sets`, `deletes`, `clears`, `errors`, `count`, `vsize`, `ksize`.

## How to Contribute

You can contribute by forking the repo and submitting a pull request. Please make sure to add tests and update the documentation. To learn more about how to contribute go to our main README [https://github.com/jaredwray/cacheable](https://github.com/jaredwray/cacheable). This will talk about how to `Open a Pull Request`, `Ask a Question`, or `Post an Issue`.

## License and Copyright
[MIT © Jared Wray](./LICENSE)