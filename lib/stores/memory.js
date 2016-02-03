var Lru = require("lru-cache");

var memoryStore = function(args) {
    args = args || {};
    var self = {};
    self.name = 'memory';
    var ttl = args.ttl;
    var lruOpts = {
        max: args.max || 500,
        maxAge: (ttl || ttl === 0) ? ttl * 1000 : null,
        dispose: args.dispose,
        length: args.length,
        stale: args.stale
    };

    var lruCache = new Lru(lruOpts);

    self.set = function(key, value, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }
        options = options || {};

        var maxAge = (options.ttl || options.ttl === 0) ? options.ttl * 1000 : lruOpts.maxAge;

        lruCache.set(key, value, maxAge);
        if (cb) {
            process.nextTick(cb);
        } else {
            return Promise.resolve(value);
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
