var fs = require('fs');
var util = require('util');
var assert = require('assert');

var support = {
    random: {
        string: function(str_len) {
            str_len = str_len || 8;
            var chars = "abcdefghiklmnopqrstuvwxyz";
            var random_str = '';
            for (var i = 0; i < str_len; i++) {
                var rnum = Math.floor(Math.random() * chars.length);
                random_str += chars.substring(rnum, rnum + 1);
            }
            return random_str;
        },

        number: function(max) {
            max = max || 1000;
            return Math.floor((Math.random() * max));
        }
    },

    check_err: function(err) {
        if (err) {
            var msg;

            if (err instanceof Error) {
                msg = err;
            } else if (err.msg) {
                msg = err.msg;
            } else {
                msg = util.inspect(err);
            }

            var error = new Error(msg);
            throw error;
        }
    },

    assert_between: function(actual, lower, upper) {
        assert.ok(actual >= lower, "Expected " + actual + " to be >= " + lower);
        assert.ok(actual <= upper, "Expected " + actual + " to be <= " + upper);
    },

    assert_within: function(actual, expected, delta) {
        var lower = expected - delta;
        var upper = expected + delta;
        this.assert_between(actual, lower, upper);
    },

    walk_dir: function(dir, validation_function, cb) {
        if (arguments.length === 2) {
            cb = validation_function;
            validation_function = null;
        }

        var results = [];
        fs.readdir(dir, function(err, list) {
            if (err) { return cb(err); }

            var pending = list.length;

            if (!pending) { return cb(null, results); }

            list.forEach(function(file) {
                file = dir + '/' + file;
                fs.stat(file, function(err, stat) {
                    if (stat && stat.isDirectory()) {
                        support.walk_dir(file, validation_function, function(err, res) {
                            results = results.concat(res);
                            if (!--pending) { cb(null, results); }
                        });
                    } else {
                        if (typeof validation_function === 'function') {
                            if (validation_function(file)) {
                                results.push(file);
                            }
                        } else {
                            results.push(file);
                        }

                        if (!--pending) { cb(null, results); }
                    }
                });
            });
        });
    },

    test_set_get_del: function(cache, cb) {
        var key = 'TEST' + support.random.string();
        var val = support.random.string();
        var ttl;

        cache.set(key, val, ttl, function(err) {
            if (err) { return cb(err); }

            cache.get(key, function(err, result) {
                if (err) { return cb(err); }
                assert.equal(result, val);

                cache.del(key, function(err) {
                    if (err) { return cb(err); }

                    cache.get(key, function(err, result) {
                        if (err) { return cb(err); }
                        assert.ok(!result);
                        cb();
                    });
                });
            });
        });
    }
};

module.exports = support;
