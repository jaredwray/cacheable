# node-cache-manager [![npm version](https://badge.fury.io/js/cache-manager.svg)](https://www.npmjs.com/package/cache-manager) [![codecov](https://codecov.io/gh/node-cache-manager/node-cache-manager/branch/master/graph/badge.svg?token=ZV3G5IFigq)](https://codecov.io/gh/node-cache-manager/node-cache-manager)

# Flexible NodeJS cache module

A cache module for nodejs that allows easy wrapping of functions in cache, tiered caches, and a consistent interface.

## Features

- Easy way to wrap any function in cache.
- Tiered caches -- data gets stored in each cache and fetched from the highest.
  priority cache(s) first.
- Use any cache you want, as long as it has the same API.
- 100% test coverage via [vitest](https://github.com/vitest-dev/vitest).

## Express.js Example

See the [Express.js cache-manager example app](https://github.com/BryanDonovan/node-cache-manager-express-example) to see how to use
`node-cache-manager` in your applications.

## Installation

    pnpm install cache-manager

## Store Engines

- [node-cache-manager-redis](https://github.com/dial-once/node-cache-manager-redis) (uses [sol-redis-pool](https://github.com/joshuah/sol-redis-pool))

- [node-cache-manager-redis-store](https://github.com/dabroek/node-cache-manager-redis-store) (uses [node_redis](https://github.com/NodeRedis/node_redis))

- [node-cache-manager-ioredis](https://github.com/dabroek/node-cache-manager-ioredis) (uses [ioredis](https://github.com/luin/ioredis))

- [node-cache-manager-redis-yet](https://github.com/node-cache-manager/node-cache-manager-redis-yet) (uses [node_redis](https://github.com/NodeRedis/node_redis))

- [node-cache-manager-mongodb](https://github.com/v4l3r10/node-cache-manager-mongodb)

- [node-cache-manager-mongoose](https://github.com/disjunction/node-cache-manager-mongoose)

- [node-cache-manager-fs-binary](https://github.com/sheershoff/node-cache-manager-fs-binary)

- [node-cache-manager-fs-hash](https://github.com/rolandstarke/node-cache-manager-fs-hash)

- [node-cache-manager-hazelcast](https://github.com/marudor/node-cache-manager-hazelcast)

- [node-cache-manager-memcached-store](https://github.com/theogravity/node-cache-manager-memcached-store)

- [node-cache-manager-memory-store](https://github.com/theogravity/node-cache-manager-memory-store)

- [node-cache-manager-couchbase](https://github.com/davidepellegatta/node-cache-manager-couchbase)

- [node-cache-manager-sqlite](https://github.com/maxpert/node-cache-manager-sqlite)

## Contribute

If you would like to contribute to the project, please fork it and send us a pull request. Please add tests
for any new features or bug fixes.

## License

node-cache-manager is licensed under the [MIT license](./LICENSE).
