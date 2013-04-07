node-cache-manager
======================

# Flexible NodeJS cache module

A cache module for nodejs that allows easy wrapping of functions in cache,
tiered caches, and a consistent interface.

## Features

* Easy way to wrap any function in cache.
* Tiered caches -- data gets stored in each cache and fetched from the highest
priority cache(s) first.
* Use any cache you want, as long as it has the same API.
* 100% test coverage via [mocha](https://github.com/visionmedia/mocha), 
  [istanbul](https://github.com/yahoo/istanbul), and [sinon](http://sinonjs.org).


## Installation

    npm install cache-manager

## Overview

First, node-cache-manager features the standard functions you'd expect in most caches:

    set(key, val, cb)
    get(key, cb)
    del(key, cb)

Second, it includes a `wrap` function that lets you wrap any function in cache.
(Note, this was inspired by [node-caching](https://github.com/mape/node-caching).)

Third, node-cache-manager lets you set up a tiered cache strategy.  This may be of
limited use in most cases, but imagine a scenario where you expect tons of
traffic, and don't want to hit Redis for every request.  You decide to store
the most commonly-requested data in an in-memory cache (like [node-lru-cache](https://github.com/isaacs/node-lru-cache)),
perhaps with a very short timeout and/or a small data size limit.  But you
still want to store the data in Redis for backup, and for the requests that
aren't as common as the ones you want to store in memory. This is something
node-cache-manager handles easily and transparently.


## Usage Examples

### Single Store

```javascript
        var cache_manager = require('cache-manager');
        var redis_cache = cache_manager.caching({store: 'redis', db: 1, ttl: 100/*seconds*/});
        var memory_cache = cache_manager.caching({store: 'memory', max: 100, ttl: 10/*seconds*/});

        // Note: callback is optional in set() and del().

        redis_cache.set('foo', 'bar', function(err) {
            if (err) { throw err; }

            redis_cache.get('foo', function(err, result) {
                console.log(result);
                // >> 'bar'
                redis_cache.del('foo', function(err) {});
            });
        });

        function get_user(id, cb) {
            setTimeout(function () {
                console.log("Returning user from slow database.");
                cb(null, {id: id, name: 'Bob'});
            }, 100);
        }

        var user_id = 123;
        var key = 'user_' + user_id; 

        redis_cache.wrap(key, function (cb) {
            get_user(user_id, cb);
        }, function (err, user) {
            console.log(user);

            // Second time fetches user from redis_cache 
            redis_cache.wrap(key, function (cb) {
                get_user(user_id, cb);
            }, function (err, user) {
                console.log(user);
            });
        });

        // Outputs:
        // Returning user from slow database.
        // { id: 123, name: 'Bob' }
        // { id: 123, name: 'Bob' }
```

### Multi-Store

        var multi_cache = cache_manager.multi_caching([memory_cache, redis_cache]);
        user_id2 = 456;
        key2 = 'user_' + user_id; 

        // Sets in all caches.
        multi_cache.set('foo2', 'bar2', function(err) {
            if (err) { throw err; }

            // Fetches from highest priority cache that has the key.
            multi_cache.get('foo2', function(err, result) {
                console.log(result);
                // >> 'bar2'

                // Delete from all caches
                multi_cache.del('foo2');
            });
        });

        multi_cache.wrap(key2, function (cb) {
            get_user(user_id2, cb);
        }, function (err, user) {
            console.log(user);

            // Second time fetches user from memory_cache, since it's highest priority.
            // If the data expires in the memory cache, the next fetch would pull it from
            // the Redis cache, and set the data in memory again.
            multi_cache.wrap(key2, function (cb) {
                get_user(user_id2, cb);
            }, function (err, user) {
                console.log(user);
            });
        });


## Tests

To run tests, first run:

    npm install -d

Run the tests and JShint:

    make


## Contribute

If you would like to contribute to the project, please fork it and send us a pull request.  Please add tests
for any new features or bug fixes.  Also run ``make`` before submitting the pull request.


## License

node-cache-manager is licensed under the MIT license.
