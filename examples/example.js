var cashew = require('cashew');
var redis_cache = cashew.caching({store: 'redis', db: 1, ttl: 100/*seconds*/});
var memory_cache = cashew.caching({store: 'memory', max: 100, ttl: 10/*seconds*/});

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


var multi_cache = cashew.multi_caching([memory_cache, redis_cache]);
user_id2 = 456;
key2 = 'user_' + user_id; 

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
    multi_cache.set('foo2', 'bar2', function(err) {
        if (err) { throw err; }

        // Fetches from highest priority cache that has the key.
        multi_cache.get('foo2', function(err, result) {
            console.log(result);
            // >> 'bar2'

            // Delete from all caches
            multi_cache.del('foo2', function(err) {
                process.exit();
            });
        });
    });
});
