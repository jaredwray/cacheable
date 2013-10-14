var Lru = require("lru-cache");

var memory_store = function (args) {
    args = args || {};
    var self = {};
    self.name = 'memory';
    var ttl = args.ttl;
    var lru_opts = {
        max: args.max || 500,
        maxAge: ttl ? ttl * 1000 : null
    };

    var lru_cache = new Lru(lru_opts);

    self.set = function (key, value, cb) {
        lru_cache.set(key, value);
        if (cb) {
            process.nextTick(cb);
        }
    };

    self.get = function (key, cb) {
        process.nextTick(function () {
            cb(null, lru_cache.get(key));
        });
    };

    self.del = function (key, cb) {
        lru_cache.del(key);
        if (cb) {
            process.nextTick(cb);
        }
    };

    return self;
};

var methods = {
    create: function (args) {
        return memory_store(args);
    }
};

module.exports = methods;
