var cache_manager = require('../');
var memory_cache = cache_manager.caching({store: 'memory', max: 100, ttl: 10/*seconds*/});
var memory_cache2 = cache_manager.caching({store: 'memory', max: 100, ttl: 100/*seconds*/});

//
// Basic usage
//
memory_cache2.set('foo', 'bar', function (err) {
    if (err) { throw err; }

    memory_cache2.get('foo', function (err, result) {
        console.log(result);
        // >> 'bar'
        memory_cache2.del('foo', function (err) { console.log(err); });
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

//
// wrap() example 
//
memory_cache2.wrap(key, function (cb) {
    get_user(user_id, cb);
}, function (err, user) {
    console.log(user);

    // Second time fetches user from memory_cache2 
    memory_cache2.wrap(key, function (cb) {
        get_user(user_id, cb);
    }, function (err, user) {
        console.log(user);
    });
});

// Outputs:
// Returning user from slow database.
// { id: 123, name: 'Bob' }
// { id: 123, name: 'Bob' }


var multi_cache = cache_manager.multi_caching([memory_cache, memory_cache2]);
var user_id2 = 456;
var key2 = 'user_' + user_id;

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

    // Sets in all caches.
    multi_cache.set('foo2', 'bar2', function (err) {
        if (err) { throw err; }

        // Fetches from highest priority cache that has the key.
        multi_cache.get('foo2', function (err, result) {
            console.log(result);
            // >> 'bar2'

            // Delete from all caches
            multi_cache.del('foo2', function (err) {
                console.log(err);
                process.exit();
            });
        });
    });
});
