/*jshint maxcomplexity:15*/
var domain = require('domain');
var CallbackFiller = require('./callback_filler');

var caching = function(args) {
    args = args || {};
    var self = {};
    if (typeof args.store === 'object') {
        if (args.store.create) {
            self.store = args.store.create(args);
        } else {
            self.store = args.store;
        }
    } else if (typeof args.store === 'string' && args.store.match(/\//)) {
        self.store = require(args.store).create(args);
    } else {
        var storeName = args.store || 'memory';
        self.store = require('./stores/' + storeName).create(args);
    }

    // do we handle a cache error the same as a cache miss?
    self.ignoreCacheErrors = args.ignoreCacheErrors || false;

    var callbackFiller = new CallbackFiller();

    /**
     * Wraps a function in cache. I.e., the first time the function is run,
     * its results are stored in cache so subsequent calls retrieve from cache
     * instead of calling the function.
     *
     * @example
     *
     *   var key = 'user_' + userId;
     *   cache.wrap(key, function(cb) {
     *       User.get(userId, cb);
     *   }, function(err, user) {
     *       console.log(user);
     *   });
     */
    self.wrap = function(key, work, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = undefined;
        }

        var hasKey = callbackFiller.has(key);
        callbackFiller.add(key, {cb: cb, domain: process.domain});
        if (hasKey) { return; }

        self.store.get(key, options, function(err, result) {
            if (err && (!self.ignoreCacheErrors)) {
                callbackFiller.fill(key, err);
            } else if (result) {
                callbackFiller.fill(key, null, result);
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
                    self.store.set(key, data, options, function(err) {
                        if (err && (!self.ignoreCacheErrors)) {
                            callbackFiller.fill(key, err);
                        } else {
                            callbackFiller.fill(key, null, data);
                        }
                    });
                });
            }
        });
    };

    self.get = self.store.get.bind(self.store);

    self.set = self.store.set.bind(self.store);

    if (typeof self.store.del === 'function') {
        self.del = self.store.del.bind(self.store);
    }

    if (typeof self.store.setex === 'function') {
        self.setex = self.store.setex.bind(self.store);
    }

    if (typeof self.store.reset === 'function') {
        self.reset = self.store.reset.bind(self.store);
    }

    if (typeof self.store.keys === 'function') {
        self.keys = self.store.keys.bind(self.store);
    }

    if (typeof self.store.ttl === 'function') {
        self.ttl = self.store.ttl.bind(self.store);
    }

    return self;
};

module.exports = caching;
