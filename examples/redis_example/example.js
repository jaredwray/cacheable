// Setup:
// npm install redis@0.6.7 sol-redis-pool@0.1.0
// node examples/redis_example/example.js

var util = require('util');
var cache_manager = require('../../');
var redis_store = require('./redis_store');
// Note: ttl is in seconds
var redis_cache = cache_manager.caching({store: redis_store, db: 0, ttl: 100});
var ttl = 60;

console.log("set/get/del example:");
redis_cache.set('foo', 'bar', ttl, function(err) {
    if (err) { throw err; }

    redis_cache.get('foo', function(err, result) {
        if (err) { throw err; }
        console.log("result fetched from cache: " + result);
        // >> 'bar'
        redis_cache.del('foo', function(err) {
            if (err) { throw err; }
        });
    });
});

var user_id = 123;

function create_key(id) {
    return 'user_' + id;
}

function get_user(id, cb) {
    setTimeout(function() {
        console.log("\n\nReturning user from slow database.");
        cb(null, {id: id, name: 'Bob'});
    }, 100);
}

function get_user_from_cache(id, cb) {
    var key = create_key(id);
    redis_cache.wrap(key, function(cache_cb) {
        get_user(user_id, cache_cb);
    }, ttl, cb);
}

get_user_from_cache(user_id, function(err, user) {
    console.log(user);

    // Second time fetches user from redis_cache
    get_user_from_cache(user_id, function(err, user) {
        console.log("user from second cache request:");
        console.log(user);

        redis_cache.keys(function(err, keys) {
            console.log("keys: " + util.inspect(keys));

            var key = create_key(user_id);
            redis_cache.del(key, function(err) {
                if (err) { throw err; }
                process.exit();
            });
        });
    });
});

// Outputs:
// { id: 123, name: 'Bob' }
// user from second cache request:
// { id: 123, name: 'Bob' }
// keys: [ 'user_123' ]
