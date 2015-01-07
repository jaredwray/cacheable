/*jshint unused:false*/
// Note: ttls are in seconds
var cache_manager = require('../');
var memory_cache = cache_manager.caching({store: 'memory', max: 100, ttl: 10});
var memory_cache2 = cache_manager.caching({store: 'memory', max: 100, ttl: 100});
var ttl; //Can't use a different ttl per set() call with memory cache

//
// Basic usage
//
memory_cache.set('foo', 'bar', ttl, function(err) {
    if (err) { throw err; }

    memory_cache.get('foo', function(err, result) {
        console.log(result);
        // >> 'bar'
        memory_cache.del('foo', function(err) {
            if (err) {
                console.log(err);
            }
        });
    });
});

function get_user(id, cb) {
    setTimeout(function() {
        console.log("Fetching user from slow database.");
        cb(null, {id: id, name: 'Bob'});
    }, 100);
}

var user_id = 123;
var key = 'user_' + user_id;

//
// wrap() example
//

// Instead of manually managing the cache like this:
function get_cached_user_manually(id, cb) {
    memory_cache.get(id, function(err, result) {
        if (err) { return cb(err); }

        if (result) {
            return cb(null, result);
        }

        get_user(id, function(err, result) {
            if (err) { return cb(err); }
            memory_cache.set(id, result);
            cb(null, result);
        });
    });
}

// ... you can instead use the `wrap` function:
function get_cached_user(id, cb) {
    memory_cache.wrap(id, function(cache_callback) {
        get_user(id, cache_callback);
    }, cb);
}

get_cached_user(user_id, function(err, user) {
    // First time fetches the user from the (fake) database:
    console.log(user);

    get_cached_user(user_id, function(err, user) {
        // Second time fetches from cache.
        console.log(user);
    });
});

// Outputs:
// Returning user from slow database.
// { id: 123, name: 'Bob' }
// { id: 123, name: 'Bob' }

// Same as above, but written differently:
memory_cache.wrap(key, function(cb) {
    get_user(user_id, cb);
}, function(err, user) {
    console.log(user);

    // Second time fetches user from memory_cache
    memory_cache.wrap(key, function(cb) {
        get_user(user_id, cb);
    }, function(err, user) {
        console.log(user);
    });
});

//
// multi-cache example
//
var multi_cache = cache_manager.multi_caching([memory_cache, memory_cache2]);
var user_id2 = 456;
var key2 = 'user_' + user_id;
var ttl2; //Can't use a different ttl per set() call with memory cache

multi_cache.wrap(key2, function(cb) {
    get_user(user_id2, cb);
}, function(err, user) {
    console.log(user);

    // Second time fetches user from memory_cache, since it's highest priority.
    // If the data expires in the memory cache, the next fetch would pull it from
    // the Redis cache, and set the data in memory again.
    multi_cache.wrap(key2, function(cb) {
        get_user(user_id2, cb);
    }, function(err, user) {
        console.log(user);
    });

    // Sets in all caches.
    multi_cache.set('foo2', 'bar2', ttl2, function(err) {
        if (err) { throw err; }

        // Fetches from highest priority cache that has the key.
        multi_cache.get('foo2', function(err, result) {
            console.log(result);
            // >> 'bar2'

            // Delete from all caches
            multi_cache.del('foo2', function(err) {
                if (err) {
                    console.log(err);
                }
                process.exit();
            });
        });
    });
});
