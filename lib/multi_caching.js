var async = require('async');

/**
 * Module that lets you specify a hierarchy of caches.
 */
var multi_caching = function (caches) {
    var self = {};
    if (!Array.isArray(caches)) { throw new Error('multi_caching requires an array of caches'); }

    function get_from_highest_priority_cache(key, cb) {
        var i = 0;
        async.forEachSeries(caches, function (cache, async_cb) {
            cache.store.get(key, function (err, result) {
                if (err) { return cb(err); }
                if (result) {
                    // break out of async loop.
                    return cb(err, result, i);
                }

                i += 1;
                async_cb(err);
            });
        }, cb);
    }

    function set_in_multiple_caches(caches, key, value, cb) {
        async.forEach(caches, function (cache, async_cb) {
            cache.store.set(key, value, async_cb);
        }, cb);
    }

    /**
     * Wraps a function in one or more caches.
     * Has same API as regular caching module.
     *
     * If a key doesn't exist in any cache, it gets set in all caches.
     * If a key exists in a high-priority (e.g., first) cache, it gets returned immediately
     * without getting set in other lower-priority caches.
     * If a key doesn't exist in a higher-priority cache but exists in a lower-priority
     * cache, it gets set in all higher-priority caches.
     */
    self.wrap = function (key, work, cb) {
        get_from_highest_priority_cache(key, function (err, result, index) {
            if (err) { return cb(err); }
            if (result) {
                var caches_to_update = caches.slice(0, index);
                set_in_multiple_caches(caches_to_update, key, result, function (err) {
                    cb(err, result);
                });
            } else {
                work(function () {
                    var work_args = Array.prototype.slice.call(arguments, 0);
                    if (work_args[0]) { // assume first arg is an error
                        return cb(work_args[0]);
                    }
                    set_in_multiple_caches(caches, key, work_args[1], function (err) {
                        if (err) { return cb(err); }
                        cb.apply(null, work_args);
                    });
                });
            }
        });
    };

    self.set = function (key, value, cb) {
        set_in_multiple_caches(caches, key, value, cb);
    };

    self.get = function (key, cb) {
        get_from_highest_priority_cache(key, cb);
    };

    self.del = function (key, cb) {
        async.forEach(caches, function (cache, async_cb) {
            cache.store.del(key, async_cb);
        }, cb);
    };

    return self;
};

module.exports = multi_caching;
