var assert = require('assert');
var support = require('../support');
var checkErr = support.checkErr;
var caching = require('../../index').caching;
var memoryStore = require('../../lib/stores/memory');

describe("memory store", function() {
    describe("instantiating", function() {
        it("lets us pass in no args", function(done) {
            var memoryCache = memoryStore.create();
            support.testSetGetDel(memoryCache, done);
        });
    });

    describe("set()", function() {
        var memoryCache;
        var origPromise;

        beforeEach(function() {
            origPromise = global.Promise;
            delete global.Promise;
            memoryCache = memoryStore.create({noPromises: true});
        });

        afterEach(function() {
            global.Promise = origPromise;
        });

        // This test should pass in node v0.10.x:
        it("does not require a callback or use of Promises", function(done) {
            memoryCache.set('foo', 'bar');

            setTimeout(function() {
                assert.equal(memoryCache.get('foo'), 'bar');
                done();
            }, 10);
        });
    });

    describe("when used with wrap() function", function() {
        var cache;
        var key;
        var opts = {};

        beforeEach(function() {
            key = support.random.string(20);
        });

        context("when cache misses", function() {
            function getCachedObject(name, cb) {
                cache.wrap(key, function(cacheCb) {
                    cacheCb(null, {foo: 'bar'});
                }, opts, cb);
            }

            function getCachedString(name, cb) {
                cache.wrap(key, function(cacheCb) {
                    cacheCb(null, 'bar');
                }, opts, cb);
            }

            function getCachedArray(name, cb) {
                cache.wrap(key, function(cacheCb) {
                    cacheCb(null, [1, 2, 3]);
                }, opts, cb);
            }

            function getCachedNumber(name, cb) {
                cache.wrap(key, function(cacheCb) {
                    cacheCb(null, 34);
                }, opts, cb);
            }

            beforeEach(function() {
                cache = caching({store: 'memory', safeClone: true, ttl: opts.ttl, ignoreCacheErrors: false});
            });

            it("does not allow mutation of objects", function(done) {
                getCachedObject('foo', function(err, result) {
                    checkErr(err);
                    result.foo = 'buzz';

                    getCachedObject('foo', function(err, result) {
                        checkErr(err);
                        assert.equal(result.foo, 'bar');
                        done();
                    });
                });
            });

            it("does not allow mutation of arrays", function(done) {
                getCachedArray('foo', function(err, result) {
                    checkErr(err);
                    result = ['a', 'b', 'c'];

                    getCachedArray('foo', function(err, result) {
                        checkErr(err);
                        assert.deepEqual(result, [1, 2, 3]);
                        done();
                    });
                });
            });

            it("does not allow mutation of strings", function(done) {
                getCachedString('foo', function(err, result) {
                    checkErr(err);
                    result = 'buzz';

                    getCachedString('foo', function(err, result) {
                        checkErr(err);
                        assert.equal(result, 'bar');
                        done();
                    });
                });
            });

            it("does not allow mutation of numbers", function(done) {
                getCachedNumber('foo', function(err, result) {
                    checkErr(err);
                    result = 12;

                    getCachedNumber('foo', function(err, result) {
                        checkErr(err);
                        assert.equal(result, 34);
                        done();
                    });
                });
            });
        });
    });
});
