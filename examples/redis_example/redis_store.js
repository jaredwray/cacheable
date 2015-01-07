/**
 * This is a very basic example of how you can implement your own Redis-based
 * cache store with connection pooling.
 */

var RedisPool = require('sol-redis-pool');

function redis_store(args) {
    args = args || {};
    var self = {};
    var ttlDefault = args.ttl;
    self.name = 'redis';
    self.client = require('redis').createClient(args.port, args.host, args);

    var redis_options = {
        redis_host: args.host || '127.0.0.1',
        redis_port: args.port || 6379
    };

    var pool = new RedisPool(redis_options);

    function connect(cb) {
        pool.acquire(function(err, conn) {
            if (err) {
                pool.release(conn);
                return cb(err);
            }

            if (args.db || args.db === 0) {
                conn.select(args.db);
            }

            cb(null, conn);
        });
    }

    self.get = function(key, cb) {
        connect(function(err, conn) {
            if (err) { return cb(err); }

            conn.get(key, function(err, result) {
                pool.release(conn);
                if (err) { return cb(err); }
                cb(null, JSON.parse(result));
            });
        });
    };

    self.set = function(key, value, ttl, cb) {
        var ttlToUse = ttl || ttlDefault;
        connect(function(err, conn) {
            if (err) { return cb(err); }

            if (ttlToUse) {
                conn.setex(key, ttlToUse, JSON.stringify(value), function(err, result) {
                    pool.release(conn);
                    cb(err, result);
                });
            } else {
                conn.set(key, JSON.stringify(value), function(err, result) {
                    pool.release(conn);
                    cb(err, result);
                });
            }
        });
    };

    self.del = function(key, cb) {
        connect(function(err, conn) {
            if (err) { return cb(err); }

            conn.del(key, function(err, result) {
                pool.release(conn);
                cb(err, result);
            });
        });
    };

    self.keys = function(pattern, cb) {
        if (typeof pattern === 'function') {
            cb = pattern;
            pattern = '*';
        }

        connect(function(err, conn) {
            if (err) { return cb(err); }

            conn.keys(pattern, function(err, result) {
                pool.release(conn);
                cb(err, result);
            });
        });
    };

    return self;
}

module.exports = {
    create: function(args) {
        return redis_store(args);
    }
};
