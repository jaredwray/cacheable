/*jshint maxcomplexity:10*/
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
    self.wrap = function (key, work, cb) {
        self.store.get(key, function (err, result) {
            if (err && (!self.ignoreCacheErrors)) { return cb(err); }
            if (result) {
                return cb(null, result);
            }

            work(function () {
                var work_args = Array.prototype.slice.call(arguments, 0);
                if (work_args[0]) { // assume first arg is an error
                    return cb(work_args[0]);
                }
                self.store.set(key, work_args[1], function (err) {
                    if (err && (!self.ignoreCacheErrors)) { return cb(err); }
                    cb.apply(null, work_args);
                });
            });
        });
    };

    self.get = self.store.get.bind(self.store);

    self.set = self.store.set.bind(self.store);

    self.del = self.store.del.bind(self.store);

    if (typeof self.store.reset === 'function') {
        self.reset = self.store.reset.bind(self.store);
    }

    if (typeof self.store.keys === 'function') {
        self.keys = self.store.keys.bind(self.store);
    }

    return self;
};

module.exports = caching;
