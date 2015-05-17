var async = require('async');
var domain = require('domain');
var CallbackFiller = require('./callback_filler');

/**
 *
 * Module that lets you specify a hierarchy of caches.
 * @param {array} caches - Array of caching objects.
 * @param {object} [options]
 * @param {function} [options.isCacheableValue] - A callback function which is called
 *   with every value returned from cache or from a wrapped function. This lets you specify
 *   which values should and should not be cached. If the function returns true, it will be
 *   stored in cache. By default it caches everything except undefined.
 */
var multiCaching = function(caches, options) {
    var self = {};
    options = options || {};

    if (!Array.isArray(caches)) {
        throw new Error('multiCaching requires an array of caches');
    }

    var callbackFiller = new CallbackFiller();

    if (typeof options.isCacheableValue === 'function') {
        self._isCacheableValue = options.isCacheableValue;
    } else {
        self._isCacheableValue = function(value) {
            return value !== undefined;
        };
    }

    function getFromHighestPriorityCache(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = undefined;
        }

        var i = 0;
        async.eachSeries(caches, function(cache, next) {
            var callback = function(err, result) {
                if (err) {
                    return next(err);
                }
                if (result) {
                    // break out of async loop.
                    return cb(err, result, i);
                }

                i += 1;
                next();
            };

            if (typeof options === 'object') {
                cache.store.get(key, options, callback);
            } else {
                cache.store.get(key, callback);
            }
        }, cb);
    }

    function setInMultipleCaches(caches, opts, cb) {
        async.each(caches, function(cache, next) {
            if (typeof opts.options === 'object') {
                cache.store.set(opts.key, opts.value, opts.options, next);
            } else {
                cache.store.set(opts.key, opts.value, opts.ttl, next);
            }
        }, cb);
    }

    /**
     * Looks for an item in cache tiers.
     * When a key is found in a lower cache, all higher levels are updated.
     *
     * @param {string} key
     * @param {function} cb
     */
    self.getAndPassUp = function(key, cb) {
        getFromHighestPriorityCache(key, function(err, result, index) {
            if (err) {
                return cb(err);
            }

            cb(err, result);

            if (result !== undefined && index) {
                var cachesToUpdate = caches.slice(0, index);
                async.each(cachesToUpdate, function(cache, next) {
                    // We rely on the cache module's default TTL
                    cache.set(key, result, next);
                });
            }
        });
    };

    /**
     * This is for backward-compatibility
     */
    //jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    self.get_and_pass_up = self.getAndPassUp;
    //jscs:enable requireCamelCaseOrUpperCaseIdentifiers

    /**
     * Wraps a function in one or more caches.
     * Has same API as regular caching module.
     *
     * If a key doesn't exist in any cache, it gets set in all caches.
     * If a key exists in a high-priority (e.g., first) cache, it gets returned immediately
     * without getting set in other lower-priority caches.
     * If a key doesn't exist in a higher-priority cache but exists in a lower-priority
     * cache, it gets set in all higher-priority caches.
     *
     * @param {string} key - The cache key to use in cache operations
     * @param {function} work - The function to wrap
     * @param {object} [options] - options passed to `set` function
     * @param {function} cb
     */
    self.wrap = function(key, work, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = undefined;
        }

        function getOptsForSet(result) {
            var opts = {
                key: key,
                value: result,
                options: options
            };

            if (typeof options !== 'object') {
                opts.ttl = options;
            }

            return opts;
        }

        var hasKey = callbackFiller.has(key);
        callbackFiller.add(key, {cb: cb, domain: process.domain});
        if (hasKey) { return; }

        getFromHighestPriorityCache(key, function(err, result, index) {
            if (err) {
                return callbackFiller.fill(key, err);
            } else if (self._isCacheableValue(result)) {
                var cachesToUpdate = caches.slice(0, index);
                var opts = getOptsForSet(result);

                setInMultipleCaches(cachesToUpdate, opts, function(err) {
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
                        return callbackFiller.fill(key, err);
                    }

                    if (!self._isCacheableValue(data)) {
                        return cb();
                    }

                    var opts = getOptsForSet(data);

                    setInMultipleCaches(caches, opts, function(err) {
                        callbackFiller.fill(key, err, data);
                    });
                });
            }
        });
    };

    /**
     * Set value in all caches
     * @param {string} key
     * @param {*} value
     * @param {object} [options] to pass to underlying set function.
     * @param {function} cb
     */
    self.set = function(key, value, options, cb) {
        var opts = {
            key: key,
            value: value,
            options: options
        };
        if (typeof options !== 'object') {
            opts.ttl = options;
        }
        setInMultipleCaches(caches, opts, cb);
    };

    /**
     * Get value from highest level cache that has stored it.
     * @param {string} key
     * @param {object} [options] to pass to underlying get function.
     * @param {function} cb
     */
    self.get = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = false;
        }
        getFromHighestPriorityCache(key, options, cb);
    };

    /**
     * Delete value from all caches.
     * @param {string} key
     * @param {object} [options] to pass to underlying del function.
     * @param {function} cb
     */
    self.del = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = false;
        }
        async.each(caches, function(cache, next) {
            if (typeof options === 'object') {
                cache.store.del(key, options, next);
            } else {
                cache.store.del(key, next);
            }
        }, cb);
    };

    return self;
};

module.exports = multiCaching;
