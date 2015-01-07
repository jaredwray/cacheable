var Lru = require("lru-cache");

var memory_store = function(args) {
    args = args || {};
    var self = {};
    self.name = 'memory';
    var ttl = args.ttl;
    var lru_opts = {
        max: args.max || 500,
        maxAge: ttl ? ttl * 1000 : null
    };

    var lru_cache = new Lru(lru_opts);

    self.set = function(key, value, ttl, cb) {
        lru_cache.set(key, value);
        if (cb) {
            process.nextTick(cb);
        }
    };

    self.get = function(key, cb) {
        var value = lru_cache.get(key);
        if (cb) {
            process.nextTick(function() {
                cb(null, value);
            });
        } else {
            return value;
        }
    };

    self.del = function(key, cb) {
        lru_cache.del(key);
        if (cb) {
            process.nextTick(cb);
        }
    };

    self.reset = function(cb) {
        lru_cache.reset();
        if (cb) {
            process.nextTick(cb);
        }
    };

    self.keys = function(cb) {
        var keys = lru_cache.keys();
        if (cb) {
            process.nextTick(function() {
                cb(null, keys);
            });
        } else {
            return keys;
        }
    };

    return self;
};

var methods = {
    create: function(args) {
        return memory_store(args);
    }
};

module.exports = methods;
