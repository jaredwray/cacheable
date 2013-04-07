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
            var stack = app_trace().split('\n');

            stack.unshift(error.message);
            error.stack = stack.join('\n');
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
    }
};

module.exports = support;
