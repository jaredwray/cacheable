var caching = function(args) {
    args = args || {};
    var self = {};
    self.store_name = args.store || 'redis';
    self.store = require('./stores/' + self.store_name).create(args);

    /**
     * Wraps a function in cache. I.e., the first time the function is run,
     * its results are stored in cache so subsequent calls retrieve from cache
     * instead of calling the function.
     *
     * @example
     *
     *   var key = 'user_' + user_id;
     *   cache.run(key, function(cb) {
     *       user_adapter.get(user_id, cb);
     *   }, function(err, user) {
     *       console.log(user);
     *   });
     */
    self.run = function(key, work, cb) {
        self.store.get(key, function(err, result) {
            if (err) { return cb(err); }
            if (result) {
                return cb(null, result);
            }

            work(function() {
                var work_args = Array.prototype.slice.call(arguments, 0);
                self.store.set(key, work_args[1], function(err) {
                    if (err) { return cb(err); }
                    cb.apply(null, work_args);
                });
            });
        });
    };

    self.get = self.store.get;

    self.set = self.store.set;

    self.del = self.store.del;

    return self;
};

module.exports = caching;
