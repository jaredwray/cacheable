var caching = require("../../index");
var assert = require("assert");
var support = require("../support");
var checkErr = support.checkErr;
var memoryFlag = "";
var key;
var value;
var testStore = function(args) {
    args = args || {};
    var self = {};
    self.name = "options";
    self.store = {};

    self.get = function(key, options, cb) {
        var optionsMapped = false;
        if (typeof options === "function") {
            cb = options;
            options = false;
            optionsMapped = true;
        }
        if (options && options.value) {
            return cb(null, options.value + "ValueOption");
        } else if (options && options.fn) {
            options.fn("GetFunctionOption");
            return cb(null, "GetFunctionOption");
        } else if (options && options.runNormal) {
            return cb(null, self.store[key]);
        } else if (optionsMapped) {
            return cb();
        }
        return cb("Error No Options");
    };

    self.set = function(key, value, options, cb) {
        var optionsMapped = false;
        if (typeof options === "function") {
            cb = options;
            options = false;
            optionsMapped = true;
        } else if (typeof options !== "object") {
            options = {ttl: options, runNormal: true};
        }
        if (options && options.value) {
            memoryFlag = options.value + "ValueOption";
            return cb();
        } else if (options && options.fn) {
            options.fn("SetFunctionOption");
            return cb();
        } else if (options && options.runNormal) {
            self.store[key] = value;
            return cb(null, self.store[key]);
        } else if (optionsMapped) {
            return cb();
        }
        return cb("Error No Options");
    };

    self.del = function(key, options, cb) {
        var optionsMapped = false;
        if (typeof options === "function") {
            cb = options;
            options = false;
            optionsMapped = true;
        }
        if (options && options.value) {
            memoryFlag = options.value + "ValueOption";
            return cb();
        } else if (options && options.fn) {
            options.fn("DeleteFunctionOption");
            return cb();
        } else if (options && options.runNormal) {
            delete self.store[key];
            return cb(null, "");
        } else if (optionsMapped) {
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
    var testInstance = caching.caching({store: testStore()});
    var testCache;

    before(function() {
        key = support.random.string(20);
        value = support.random.string(20);
        testCache = caching.multiCaching([testInstance]);
    });

    describe("get with options", function() {
        it("lets us pass options by value", function(done) {
            var options = {value: value};
            testCache.get(key, options, function(err, response) {
                assert.equal(response, value + "ValueOption");
                done();
            });
        });

        it("lets us pass options by function", function(done) {
            var options = {
                fn: function(response) {
                    assert.equal(response, "GetFunctionOption");
                    done();
                }
            };
            testCache.get(key, options, function(err, response) {
                assert.equal(response, "GetFunctionOption");
            });
        });
    });

    describe("set with options", function() {
        var ttl = 60;

        it("lets us pass options by value", function(done) {
            var options = {ttl: ttl, value: value};
            testCache.set(key, value, options, function() {
                assert.equal(memoryFlag, value + "ValueOption");
                done();
            });
        });

        it("lets us pass options by function", function(done) {
            var options = {
                ttl: ttl,
                fn: function(response) {
                    assert.equal(response, "SetFunctionOption");
                    done();
                }
            };
            testCache.set(key, value, options, function() {}, options);
        });
    });

    describe("delete with options", function() {
        it("lets us pass options by value", function(done) {
            var options = {value: value};
            testCache.del(key, options, function() {
                assert.equal(memoryFlag,value + "ValueOption");
                done();
            });
        });

        it("lets us pass options by function", function(done) {
            var options = {
                fn: function(response) {
                    assert.equal(response, "DeleteFunctionOption");
                    done();
                }
            };
            testCache.del(key, options, function() {}, options);
        });
    });
});

describe("Multiple stores with options", function() {
    var testInstance = caching.caching({store: testStore()});
    var memInstance = caching.caching({store: "memory"});
    var testCache;
    var options = {runNormal: true};
    var ttl = 1;

    before(function() {
        key = support.random.string(20);
        value = support.random.string(20);
        testCache = caching.multiCaching([testInstance, memInstance]);
    });

    it("lets us pass options which only one store uses", function() {
        testCache.set(key, value, options, function(err) {
            checkErr(err);
            testCache.get(key, options, function(err, response) {
                checkErr(err);
                assert.equal(response, value);
                testCache.del(key, options, function(err) {
                    checkErr(err);
                    testCache.get(key, options, function(err, response) {
                        checkErr(err);
                        assert.equal(response, undefined);
                    });
                });
            });
        });
    });

    it("lets us not pass options which only one store uses", function() {
        testCache.set(key, value, ttl, function(err) {
            checkErr(err);
            testCache.get(key, function(err, response) {
                checkErr(err);
                assert.equal(response, value);
                testCache.del(key, function(err) {
                    checkErr(err);
                    testCache.get(key, function(err, response) {
                        checkErr(err);
                        assert.equal(response, undefined);
                    });
                });
            });
        });
    });
});
