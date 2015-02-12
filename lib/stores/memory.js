var Lru = require("lru-cache");

var memoryStore = function(args) {
    args = args || {};
    var self = {};
    self.name = 'memory';
    var ttl = args.ttl;
    var lruOpts = {
        max: args.max || 500,
        maxAge: ttl ? ttl * 1000 : null
    };

    var lruCache = new Lru(lruOpts);

    self.set = function(key, value, options, cb) {
        lruCache.set(key, value);
        if (cb) {
            process.nextTick(cb);
        }
    };

    self.get = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
        }
        var value = lruCache.get(key);
        if (cb) {
            process.nextTick(function() {
                cb(null, value);
            });
        } else {
            return value;
        }
    };

    self.del = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
        }
        lruCache.del(key);
        if (cb) {
            process.nextTick(cb);
        }
    };

    self.reset = function(cb) {
        lruCache.reset();
        if (cb) {
            process.nextTick(cb);
        }
    };

    self.keys = function(cb) {
        var keys = lruCache.keys();
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
        return memoryStore(args);
    }
};

module.exports = methods;
