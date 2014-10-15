[![build status](https://secure.travis-ci.org/BryanDonovan/node-cache-manager.png)](http://travis-ci.org/BryanDonovan/node-cache-manager)
[![Coverage Status](https://coveralls.io/repos/BryanDonovan/node-cache-manager/badge.png?branch=master)](https://coveralls.io/r/BryanDonovan/node-cache-manager?branch=master)

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


## Express.js Example

See the [Express.js cache-manager example app](https://github.com/BryanDonovan/node-cache-manager-express-example) to see how to use
``node-cache-manager`` in your applications.

## Installation

    npm install cache-manager

## Overview

First, it includes a `wrap` function that lets you wrap any function in cache.
(Note, this was inspired by [node-caching](https://github.com/mape/node-caching).)
This is probably the feature you're looking for.  As an example, where you might have to do this:

```javascript
function get_cached_user(id, cb) {
    memory_cache.get(id, function (err, result) {
        if (err) { return cb(err); }

        if (result) {
            return cb(null, result);
        }

        get_user(id, function (err, result) {
            if (err) { return cb(err); }
            memory_cache.set(id, result);
            cb(null, result);
        });
    });
}
```
... you can instead use the `wrap` function:

```javascript
function get_cached_user(id, cb) {
    memory_cache.wrap(id, function (cache_callback) {
        get_user(id, cache_callback);
    }, ttl, cb);
}
```

Second, node-cache-manager features a built-in memory cache (using [node-lru-cache](https://github.com/isaacs/node-lru-cache)),
with the standard functions you'd expect in most caches:

    set(key, val, ttl, cb)
    get(key, cb)
    del(key, cb)

Third, node-cache-manager lets you set up a tiered cache strategy.  This may be of
limited use in most cases, but imagine a scenario where you expect tons of
traffic, and don't want to hit your primary cache (like Redis) for every request.
You decide to store the most commonly-requested data in an in-memory cache,
perhaps with a very short timeout and/or a small data size limit.  But you
still want to store the data in Redis for backup, and for the requests that
aren't as common as the ones you want to store in memory. This is something
node-cache-manager handles easily and transparently.


## Usage Examples

See examples below and in the examples directory.  See ``examples/redis_example`` for an example of how to implement a
Redis cache store with connection pooling.

### Single Store

```javascript
var cache_manager = require('cache-manager');
var memory_cache = cache_manager.caching({store: 'memory', max: 100, ttl: 10/*seconds*/});
var ttl = 5;
// Note: callback is optional in set() and del().

memory_cache.set('foo', 'bar', ttl, function(err) {
    if (err) { throw err; }

    memory_cache.get('foo', function(err, result) {
        console.log(result);
        // >> 'bar'
        memory_cache.del('foo', function(err) {});
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

// Note: ttl is optional in wrap()
memory_cache.wrap(key, function (cb) {
    get_user(user_id, cb);
}, ttl, function (err, user) {
    console.log(user);

    // Second time fetches user from memory_cache
    memory_cache.wrap(key, function (cb) {
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

Here's a very basic example of how you could use this in an Express app:

```javascript
function respond(res, err, data) {
    if (err) {
        res.json(500, err);
    } else {
        res.json(200, data);
    }
}

app.get('/foo/bar', function(req, res) {
    var cache_key = 'foo-bar:' + JSON.stringify(req.query);
    var ttl = 10;
    memory_cache.wrap(cache_key, function(cache_cb) {
        DB.find(req.query, cache_cb);
    }, ttl, function(err, result) {
        respond(res, err, result);
    });
});
```

#### Custom Stores

You can use your own custom store by creating one with the same API as the
build-in memory stores (such as a redis or memcached store).  To use your own store, you can either pass
in an instance of it, or pass in the path to the module.

E.g.,

```javascript
var my_store = require('your-homemade-store');
var cache = cache_manager.caching({store: my_store});
// or
var cache = cache_manager.caching({store: '/path/to/your/store'});
```

### Multi-Store

```javascript
var multi_cache = cache_manager.multi_caching([memory_cache, some_other_cache]);
user_id2 = 456;
key2 = 'user_' + user_id;
ttl = 5;

// Sets in all caches.
multi_cache.set('foo2', 'bar2', ttl, function(err) {
    if (err) { throw err; }

    // Fetches from highest priority cache that has the key.
    multi_cache.get('foo2', function(err, result) {
        console.log(result);
        // >> 'bar2'

        // Delete from all caches
        multi_cache.del('foo2');
    });
});

// Note: ttl is optional in wrap()
multi_cache.wrap(key2, function (cb) {
    get_user(user_id2, cb);
}, ttl, function (err, user) {
    console.log(user);

    // Second time fetches user from memory_cache, since it's highest priority.
    // If the data expires in the memory cache, the next fetch would pull it from
    // the 'some_other_cache', and set the data in memory again.
    multi_cache.wrap(key2, function (cb) {
        get_user(user_id2, cb);
    }, function (err, user) {
        console.log(user);
    });
});
```

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
