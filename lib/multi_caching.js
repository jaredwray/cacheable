var async = require('async');
var domain = require('domain');
var CallbackFiller = require('./callback_filler');

/**
 * Module that lets you specify a hierarchy of caches.
 */
var multi_caching = function(caches) {
    var self = {};
    if (!Array.isArray(caches)) {
        throw new Error('multi_caching requires an array of caches');
    }

    var callbackFiller = new CallbackFiller();

    function get_from_highest_priority_cache(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = undefined;
        }

        var i = 0;
        async.eachSeries(caches, function(cache, async_cb) {
            var callback = function(err, result) {
                if (err) {
                    return cb(err);
                }
                if (result) {
                    // break out of async loop.
                    return cb(err, result, i);
                }

                i += 1;
                async_cb(err);
            };
            if (typeof options === 'object') {
                cache.store.get(key, options, callback);
            } else {
                cache.store.get(key, callback);
            }
        }, cb);
    }

    function set_in_multiple_caches(caches, opts, cb) {
        async.each(caches, function(cache, async_cb) {
            if (typeof opts.options !== 'object') {
                cache.store.set(opts.key, opts.value, opts.ttl, async_cb);
            } else {
                cache.store.set(opts.key, opts.value, opts.options, async_cb);
            }
        }, cb);
    }

    /**
     * Looks for an item in cache tiers.
     *
     * When a key is found in a lower cache, all higher levels are updated
     */
    self.get_and_pass_up = function(key, cb) {
        get_from_highest_priority_cache(key, function(err, result, index) {
            if (err) {
                return cb(err);
            }

            cb(err, result);

            if (result !== undefined && index) {
                var cachesToUpdate = caches.slice(0, index);
                async.each(cachesToUpdate, function(cache, async_cb) {
                    cache.set(key, result, result.ttl, async_cb);
                });
            }
        });
    };

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
    self.wrap = function(key, work, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = undefined;
        }

        if (callbackFiller.queues[key]) {
            callbackFiller.queues[key].push({cb: cb, domain: process.domain});
            return;
        }

        callbackFiller.queues[key] = [{cb: cb, domain: process.domain}];

        get_from_highest_priority_cache(key, function(err, result, index) {
            if (err) {
                return callbackFiller.fill(key, err);
            } else if (result) {
                var caches_to_update = caches.slice(0, index);
                var opts = {
                    key: key,
                    value: result,
                    options: options
                };

                if (typeof options !== 'object') {
                    opts.ttl = options;
                }

                set_in_multiple_caches(caches_to_update, opts, function(err) {
                    callbackFiller.fill(key, err, result);
                });
            } else {
                domain
                    .create()
                    .on('error', function(err) {
                        callbackFiller.fill(key, err);
                    })
                    .bind(work)(function(err, data) {
                    if (err) {
                        callbackFiller.fill(key, err);
                        return;
                    }
                    var opts = {
                        key: key,
                        value: data,
                        options: options
                    };

                    if (typeof options !== 'object') {
                        opts.ttl = options;
                    }
                    set_in_multiple_caches(caches, opts, function(err) {
                        if (err) {
                            callbackFiller.fill(key, err);
                        } else {
                            callbackFiller.fill(key, null, data);
                        }
                    });
                });
            }
        });
    };

    self.set = function(key, value, options, cb) {
        var opts = {
            key: key,
            value: value,
            options: options
        };
        if (typeof options !== 'object') {
            opts.ttl = options;
        }
        set_in_multiple_caches(caches, opts, cb);
    };

    self.get = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = false;
        }
        get_from_highest_priority_cache(key, options, cb);
    };

    self.del = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = false;
        }
        async.each(caches, function(cache, async_cb) {
            if (typeof options === 'object') {
                cache.store.del(key, options, async_cb);
            } else {
                cache.store.del(key, async_cb);
            }
        }, cb);
    };

    return self;
};

module.exports = multi_caching;
