/*jshint maxcomplexity:15*/
var caching = function (args) {
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
    self.wrap = function (key, work, ttl, cb) {
        if (typeof ttl === 'function') {
            cb = ttl;
            ttl = undefined;
        }

        self.store.get(key, function (err, result) {
            if (err && (!self.ignoreCacheErrors)) {
                cb(err);
            } else if (result) {
                cb.call(cb, null, result);
            } else if (self.queues[key]) {
                self.queues[key].push(cb);
            } else {
                self.queues[key] = [cb];

                work(function () {
                    var work_args = Array.prototype.slice.call(arguments, 0);
                    if (work_args[0]) { // assume first arg is an error
                        self.queues[key].forEach(function (done) {
                            done.call(null, work_args[0]);
                        });
                        delete self.queues[key];
                        return;
                    }
                    // Subsequently assume second arg is result.
                    self.store.set(key, work_args[1], ttl, function (err) {
                        if (err && (!self.ignoreCacheErrors)) {
                            self.queues[key].forEach(function (done) {
                                done.call(null, err);
                            });
                        } else {
                            self.queues[key].forEach(function (done) {
                                done.apply(null, work_args);
                            });
                        }

                        delete self.queues[key];
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
