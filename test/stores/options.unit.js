/*jshint -W072 */

var caching = require("../../index");
var assert = require("assert");
var support = require('../support');
var memoryFlag = "";
var key;
var value;
var testStore = function(args) {
    args = args || {};
    var self = {};
    self.name = "options";

    self.get = function(key, cb, options) {
        if (options && options.value) {
            return cb(null, options.value + "ValueOption");
        } else if (options && options.fn) {
            options.fn("GetFunctionOption");
            return cb(null, "GetFunctionOption");
        }
        return cb("Error No Options");
    };

    self.set = function(key, value, ttl, cb, options) {
        if (options && options.value) {
            memoryFlag = options.value + "ValueOption";
            return cb();
        } else if (options && options.fn) {
            options.fn("SetFunctionOption");
            return cb();
        }
        return cb("Error No Options");
    };

    self.del = function(key, cb, options) {
        if (options && options.value) {
            memoryFlag = options.value + "ValueOption";
            return cb();
        } else if (options && options.fn) {
            options.fn("DeleteFunctionOption");
            return cb();
        }
        return cb("Error No Options");
    };

    return {
        create: function() {
            return self;
        }
    };
};

describe("Methods with options", function() {
    before(function() {
        key = support.random.string(20);
        value = support.random.string(20);
    });
    describe("get with options", function() {
        var testInstance = caching.caching({store: testStore()});
        var testCache;
        before(function() {
            testCache = caching.multi_caching([testInstance]);
        });

        it("lets us pass options by value", function(done) {
            var options = {value: value};
            testCache.get(key, function(err, response) {
                assert.equal(response, value + "ValueOption");
                done();
            }, options);
        });

        it("lets us pass options by function", function(done) {
            var options = {
                fn: function(response) {
                    assert.equal(response, "GetFunctionOption");
                    done();
                }
            };
            testCache.get(key, function(err, response) {
                assert.equal(response, "GetFunctionOption");
            }, options);
        });
    });
    describe("set with options", function() {
        var testInstance = caching.caching({store: testStore()});
        var testCache;
        var ttl = 60;
        before(function() {
            testCache = caching.multi_caching([testInstance]);
        });

        it("lets us pass options by value", function(done) {
            var options = {value: value};
            testCache.set(key, value, ttl, function() {
                assert.equal(memoryFlag,value + "ValueOption");
                done();
            }, options);
        });

        it("lets us pass options by function", function(done) {
            var options = {
                fn: function(response) {
                    assert.equal(response, "SetFunctionOption");
                    done();
                }
            };
            testCache.set(key, value, ttl, function() {}, options);
        });
    });
    describe("delete with options", function() {
        var testInstance = caching.caching({store: testStore()});
        var testCache;
        before(function() {
            testCache = caching.multi_caching([testInstance]);
        });

        it("lets us pass options by value", function(done) {
            var options = {value: value};
            testCache.del(key, function() {
                assert.equal(memoryFlag,value + "ValueOption");
                done();
            }, options);
        });

        it("lets us pass options by function", function(done) {
            var options = {
                fn: function(response) {
                    assert.equal(response, "DeleteFunctionOption");
                    done();
                }
            };
            testCache.del(key, function() {}, options);
        });
    });
});
