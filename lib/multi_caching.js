/** @module cacheManager/multiCaching */
var async = require('async');
var domain = require('domain');
var CallbackFiller = require('./callback_filler');

/**
 * Module that lets you specify a hierarchy of caches.
 *
 * @param {array} caches - Array of caching objects.
 * @param {object} [options]
 * @param {function} [options.isCacheableValue] - A callback function which is called
 *   with every value returned from cache or from a wrapped function. This lets you specify
 *   which values should and should not be cached. If the function returns true, it will be
 *   stored in cache. By default it caches everything except undefined.
 *
 *   If an underlying cache specifies its own isCacheableValue function, that function will
 *   be used instead of the multiCaching's _isCacheableValue function.
 *
 * @param {function} [options.isReturnableValue] - A callback function which is called
 *   with every value returned from cache. This lets you specify which values should and
 *   should not be returned if found in the cache. If the function returns true, it will be
 *   immediately returned by the cache. This is useful when you want multiCaching to return the
 *   first result it finds instead of checking all cache providers. Or if values such as null
 *   or undefined are valid to be returned, but not to be stored. By default this function
 *   is set to the same value as isCacheableValue.
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

    if (typeof options.isReturnableValue === 'function') {
        console.log('setting isReturnableValue to options');
        self._isReturnableValue = options.isReturnableValue;
    } else {
        console.log('setting isReturnableValue to self._isCacheableValue');
        self._isReturnableValue = self._isCacheableValue;
    }

    /**
     * If the underlying cache specifies its own isCacheableValue function (such
     * as how node-cache-manager-redis does), use that function, otherwise use
     * self._isCacheableValue function.
     */
    function getIsCacheableValueFunction(cache) {
        if (cache.store && typeof cache.store.isCacheableValue === 'function') {
            console.log('returning isReturnableValue from cache.store');
            return cache.store.isCacheableValue;
        } else {
            console.log('returning self._isReturnableValue');
            return self._isCacheableValue;
        }
    }

    /**
     * If the underlying cache specifies its own isReturnableValue function, use
     * that function, otherwise use self._isReturnableValue function.
     */
    function getIsReturnableValueFunction(cache) {
        if (cache.store && typeof cache.store.isReturnableValue === 'function') {
            return cache.store.isReturnableValue;
        } else {
            return self._isReturnableValue;
        }
    }

    function getFromHighestPriorityCachePromise(key, options) {
        return new Promise(function(resolve, reject) {
            getFromHighestPriorityCache(key, options, function(err, result) {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    function getFromHighestPriorityCache(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }

        if (!cb) {
            return getFromHighestPriorityCachePromise(key, options);
        }

        var i = 0;
        async.eachSeries(caches, function(cache, next) {
            var callback = function(err, result) {
                if (err) {
                    return next(err);
                }

                var _isReturnableValue = getIsReturnableValueFunction(cache);

                if (_isReturnableValue(result)) {
                    console.log('isReturnableValue true for [' + result + '] in cache ' + i);
                    // break out of async loop.
                    return cb(err, result, i);
                }

                i += 1;
                next();
            };

            cache.store.get(key, options, callback);
        }, function(err, result) {
            console.log('calling cb from async.eachSeries with [' + result + '] error ' + err);
            return cb(err, result);
        });
    }

    function setInMultipleCachesPromise(caches, opts) {
        return new Promise(function(resolve, reject) {
            setInMultipleCaches(caches, opts, function(err, result) {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    function setInMultipleCaches(caches, opts, cb) {
        opts.options = opts.options || {};

        if (!cb) {
            return setInMultipleCachesPromise(caches, opts);
        }

        async.each(caches, function(cache, next) {
            var _isCacheableValue = getIsCacheableValueFunction(cache);

            if (_isCacheableValue(opts.value)) {
                cache.store.set(opts.key, opts.value, opts.options, next);
            } else {
                next();
            }
        }, function(err, result) {
            cb(err, result);
        });
    }

    function getAndPassUpPromise(key) {
        return new Promise(function(resolve, reject) {
            self.getAndPassUp(key, function(err, result) {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
    }

    /**
     * Looks for an item in cache tiers.
     * When a key is found in a lower cache, all higher levels are updated.
     *
     * @param {string} key
     * @param {function} cb
     */
    self.getAndPassUp = function(key, cb) {
        if (!cb) {
            return getAndPassUpPromise(key);
        }

        getFromHighestPriorityCache(key, function(err, result, index) {
            if (err) {
                return cb(err);
            }

            if (index) {
                var cachesToUpdate = caches.slice(0, index);
                async.each(cachesToUpdate, function(cache, next) {
                    var _isCacheableValue = getIsCacheableValueFunction(cache);
                    if (_isCacheableValue(result)) {
                        // We rely on the cache module's default TTL
                        cache.set(key, result, next);
                    }
                });
            }

            return cb(err, result);
        });
    };

    function wrapPromise(key, promise, options) {
        return new Promise(function(resolve, reject) {
            self.wrap(key, function(cb) {
                Promise.resolve()
                .then(promise)
                .then(function(result) {
                    cb(null, result);
                })
                .catch(cb);
            }, options, function(err, result) {
                if (err) {
                    return reject(err);
                }
                resolve(result);
            });
        });
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
     *
     * @param {string} key - The cache key to use in cache operations
     * @param {function} work - The function to wrap
     * @param {object} [options] - options passed to `set` function
     * @param {function} cb
     */
    self.wrap = function(key, work, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }

        function getOptsForSet(value) {
            return {
                key: key,
                value: value,
                options: options
            };
        }

        if (!cb) {
            return wrapPromise(key, work, options);
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
                    if (callbackFiller.has(key)) {
                        callbackFiller.fill(key, err);
                    }
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
     *
     * @function
     * @name set
     *
     * @param {string} key
     * @param {*} value
     * @param {object} [options] to pass to underlying set function.
     * @param {function} [cb]
     */
    self.set = function(key, value, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }

        var opts = {
            key: key,
            value: value,
            options: options
        };

        return setInMultipleCaches(caches, opts, cb);
    };

    /**
     * Get value from highest level cache that has stored it.
     *
     * @function
     * @name get
     *
     * @param {string} key
     * @param {object} [options] to pass to underlying get function.
     * @param {function} cb
     */
    self.get = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }

        return getFromHighestPriorityCache(key, options, cb);
    };

    /**
     * Delete value from all caches.
     *
     * @function
     * @name del
     *
     * @param {string} key
     * @param {object} [options] to pass to underlying del function.
     * @param {function} cb
     */
    self.del = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }

        async.each(caches, function(cache, next) {
            cache.store.del(key, options, next);
        }, cb);
    };

    return self;
};

module.exports = multiCaching;
