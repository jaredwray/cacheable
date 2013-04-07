/**
 * Note: You very likely want to use your own Redis-based cache store instead
 * of this one, especially for connection pooling.  This is primarily an
 * example implementation.
 */
function redis_store(args) {
    args = args || {};
    var self = {};
    var ttl = args.ttl;
    self.name = 'redis';
    self.client = require('redis').createClient(args.port, args.host, args);
    if (args.db) {
        self.client.select(args.db);
    }

    self.get = function (key, cb) {
        self.client.get(key, function (err, result) {
            cb(err, JSON.parse(result));
        });
    };

    self.set = function (key, value, cb) {
        if (ttl) {
            self.client.setex(key, ttl, JSON.stringify(value), cb);
        } else {
            self.client.set(key, JSON.stringify(value), cb);
        }
    };

    self.del = function (key, cb) {
        self.client.del(key, cb);
    };

    return self;
}


var methods = {
    create: function (args) {
        return redis_store(args);
    }
};

module.exports = methods;
