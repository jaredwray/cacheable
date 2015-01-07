/*jshint maxcomplexity:15*/
var domain = require('domain');

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
        var store_name = args.store || 'memory';
        self.store = require('./stores/' + store_name).create(args);
    }

    // do we handle a cache error the same as a cache miss?
    self.ignoreCacheErrors = args.ignoreCacheErrors || false;

    self.queues = {};

    /**
     * Wraps a function in cache. I.e., the first time the function is run,
     * its results are stored in cache so subsequent calls retrieve from cache
     * instead of calling the function.
     *
     * @example
     *
     *   var key = 'user_' + user_id;
     *   cache.wrap(key, function(cb) {
     *       User.get(user_id, cb);
     *   }, function(err, user) {
     *       console.log(user);
     *   });
     */
    self.wrap = function(key, work, ttl, cb) {
        if (typeof ttl === 'function') {
            cb = ttl;
            ttl = undefined;
        }

        if (self.queues[key]) {
            self.queues[key].push({cb: cb, domain: process.domain});
            return;
        }

        self.queues[key] = [{cb: cb, domain: process.domain}];

        function fillCallbacks(err, data) {
            self.queues[key].forEach(function(task) {
                var taskDomain = task.domain || domain.create();
                taskDomain.bind(task.cb)(err, data);
            });
            delete self.queues[key];
        }

        self.store.get(key, function(err, result) {
            if (err && (!self.ignoreCacheErrors)) {
                fillCallbacks(err);
            } else if (result) {
                fillCallbacks(null, result);
            } else {
                domain
                .create()
                .on('error', function(err) {
                    fillCallbacks(err);
                })
                .bind(work)(function(err, data) {
                    if (err) {
                        fillCallbacks(err);
                        return;
                    }
                    self.store.set(key, data, ttl, function(err) {
                        if (err && (!self.ignoreCacheErrors)) {
                            fillCallbacks(err);
                        } else {
                            fillCallbacks(null, data);
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

    return self;
};

module.exports = caching;
