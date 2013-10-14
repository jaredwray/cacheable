// Setup:
// npm install redis
// npm install sol-redis-pool
// node examples/redis_example/example.js

var cache_manager = require('../../');
var redis_store = require('./redis_store');
var redis_cache = cache_manager.caching({store: redis_store, db: 0, ttl: 100/*seconds*/});

redis_cache.set('foo', 'bar', function (err) {
    if (err) { throw err; }

    redis_cache.get('foo', function (err, result) {
        console.log(result);
        // >> 'bar'
        redis_cache.del('foo', function (err) { console.log(err); });
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
        process.exit();
    });
});

// Outputs:
// Returning user from slow database.
// { id: 123, name: 'Bob' }
// { id: 123, name: 'Bob' }
