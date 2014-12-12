var async = require('async');

/**
 * Module that lets you specify a hierarchy of caches.
 */
var multi_caching = function (caches) {
    var self = {};
    if (!Array.isArray(caches)) { throw new Error('multi_caching requires an array of caches'); }

    self.queues = {};

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

    function set_in_multiple_caches(caches, opts, cb) {
        async.forEach(caches, function (cache, async_cb) {
            cache.store.set(opts.key, opts.value, opts.ttl, async_cb);
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
    self.wrap = function (key, work, ttl, cb) {
        if (typeof ttl === 'function') {
            cb = ttl;
            ttl = undefined;
        }

        if (self.queues[key]) {
            self.queues[key].push(cb);
            return;
        }

        self.queues[key] = [cb];

        function fillCallbacks(err, data) {
            self.queues[key].forEach(function(f) {
                f(err, data);
            });
            delete self.queues[key];
        }

        get_from_highest_priority_cache(key, function (err, result, index) {
            if (err) {
                return fillCallbacks(err);
            } else if (result) {
                var caches_to_update = caches.slice(0, index);
                var opts = {
                    key: key,
                    value: result,
                    ttl: ttl
                };
                set_in_multiple_caches(caches_to_update, opts, function (err) {
                    fillCallbacks(err, result);
                });
            } else {
                work(function (err, data) {
                    if (err) {
                        fillCallbacks(err, null);
                        return;
                    }
                    var opts = {
                        key: key,
                        value: data,
                        ttl: ttl
                    };
                    set_in_multiple_caches(caches, opts, function (err) {
                        if (err) {
                            fillCallbacks(err);
                        } else {
                            fillCallbacks(null, data);
                        }
                    });
                });
            }
        });
    };

    self.set = function (key, value, ttl, cb) {
        var opts = {
            key: key,
            value: value,
            ttl: ttl
        };
        set_in_multiple_caches(caches, opts, cb);
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
