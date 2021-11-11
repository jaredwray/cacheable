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
                    cacheCb(null, {foo: 'bar', arr: [1, 2, 3]});
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

            function getCachedFunction(name, cb) {
                cache.wrap(key, function(cacheCb) {
                    cacheCb(null, function() {
                        return 'foo';
                    });
                }, opts, cb);
            }

            function getCachedObjectWithPrototype(name, cb) {
                function Thing() {}
                Thing.prototype.f = function() {
                    return 'foo';
                };
                cache.wrap(key, function(cacheCb) {
                    cacheCb(null, new Thing());
                }, opts, cb);
            }

            function assertCachedObjectWithPrototype(result) {
                assert.equal(typeof result, 'object');
                var prototype = Object.getPrototypeOf(result);
                assert.equal(typeof prototype.f, 'function', 'prototype does not have function f');
                assert.equal(result.f(), 'foo', 'prototype function f does not return expected value');
            }

            // By default, memory store clones values before setting in the set method.
            context("when shouldCloneBeforeSet option is not passed in", () => {
                beforeEach(function() {
                    cache = caching({store: 'memory', ttl: opts.ttl, ignoreCacheErrors: false});
                });

                it("does not allow mutation of objects", function(done) {
                    getCachedObject('foo', function(err, result) {
                        checkErr(err);
                        result.foo = 'buzz';

                        getCachedObject('foo', function(err, result) {
                            checkErr(err);
                            assert.equal(result.foo, 'bar');
                            assert.deepEqual(result.arr, [1, 2, 3]);
                            done();
                        });
                    });
                });

                it("does not allow mutation of arrays", function(done) {
                    getCachedArray('foo', function(err, result) {
                        checkErr(err);
                        assert.ok(result);
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
                        assert.ok(result);
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
                        assert.ok(result);
                        result = 12;

                        getCachedNumber('foo', function(err, result) {
                            checkErr(err);
                            assert.equal(result, 34);
                            done();
                        });
                    });
                });

                it("preserves functions", function(done) {
                    getCachedFunction('foo', function(err, result) {
                        checkErr(err);
                        assert.equal(typeof result, 'function');

                        getCachedFunction('foo', function(err, result) {
                            checkErr(err);
                            assert.equal(typeof result, 'function');
                            done();
                        });
                    });
                });

                it("preserves object prototype", function(done) {
                    getCachedObjectWithPrototype('foo', function(err, result) {
                        checkErr(err);
                        assertCachedObjectWithPrototype(result);

                        getCachedObjectWithPrototype('foo', function(err, result) {
                            checkErr(err);
                            assertCachedObjectWithPrototype(result);
                            done();
                        });
                    });
                });
            });

            context("when shouldCloneBeforeSet=false option is passed in", () => {
                beforeEach(function() {
                    cache = caching({store: 'memory', ttl: opts.ttl, shouldCloneBeforeSet: false, ignoreCacheErrors: false});
                });

                it("*does* allow mutation of objects", function(done) {
                    getCachedObject('foo', function(err, result) {
                        checkErr(err);
                        result.foo = 'buzz';

                        getCachedObject('foo', function(err, result) {
                            checkErr(err);
                            assert.equal(result.foo, 'buzz');
                            done();
                        });
                    });
                });

                it("does not allow mutation of arrays", function(done) {
                    getCachedArray('foo', function(err, result) {
                        checkErr(err);
                        assert.ok(result);
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
                        assert.ok(result);
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
                        assert.ok(result);
                        result = 12;

                        getCachedNumber('foo', function(err, result) {
                            checkErr(err);
                            assert.equal(result, 34);
                            done();
                        });
                    });
                });

                it("preserves functions", function(done) {
                    getCachedFunction('foo', function(err, result) {
                        checkErr(err);
                        assert.equal(typeof result, 'function');

                        getCachedFunction('foo', function(err, result) {
                            checkErr(err);
                            assert.equal(typeof result, 'function');
                            done();
                        });
                    });
                });

                it("preserves object prototype", function(done) {
                    getCachedObjectWithPrototype('foo', function(err, result) {
                        checkErr(err);
                        assertCachedObjectWithPrototype(result);

                        getCachedObjectWithPrototype('foo', function(err, result) {
                            checkErr(err);
                            assertCachedObjectWithPrototype(result);
                            done();
                        });
                    });
                });
            });
        });
    });

    describe("dump()", function() {
        var memoryCache;
        var key1;
        var value1;
        var key2;
        var value2;

        beforeEach(function() {
            key1 = support.random.string(20);
            value1 = support.random.string();
            key2 = support.random.string(20);
            value2 = support.random.string();
        });

        it("lets us dump data without callback", function() {
            memoryCache = memoryStore.create({noPromises: true});
            memoryCache.set(key1, value1);
            memoryCache.set(key2, value2);

            const data = memoryCache.dump();
            assert.equal(data[0].k, key2);
            assert.equal(data[0].v, value2);
            assert.equal(data[1].k, key1);
            assert.equal(data[1].v, value1);
        });

        it("lets us dump data with callback", function() {
            memoryCache = memoryStore.create({noPromises: true});
            memoryCache.set(key1, value1);
            memoryCache.set(key2, value2);

            memoryCache.dump((err, data) => {
                checkErr(err);
                assert.equal(data[0].k, key2);
                assert.equal(data[0].v, value2);
                assert.equal(data[1].k, key1);
                assert.equal(data[1].v, value1);
            });
        });

        it("lets us dump data with Promise", async function() {
            memoryCache = memoryStore.create();
            memoryCache.set(key1, value1);
            memoryCache.set(key2, value2);

            const data = await memoryCache.dump();
            assert.equal(data[0].k, key2);
            assert.equal(data[0].v, value2);
            assert.equal(data[1].k, key1);
            assert.equal(data[1].v, value1);
        });
    });

    describe("load()", function() {
        var memoryCache;
        var key1;
        var value1;
        var key2;
        var value2;
        var data;

        beforeEach(function() {
            key1 = support.random.string(20);
            value1 = support.random.string();
            key2 = support.random.string(20);
            value2 = support.random.string();
            data = [
                {
                    k: key1,
                    v: value1
                },
                {
                    k: key2,
                    v: value2
                }
            ];
        });

        it("lets us load data with callback", function() {
            memoryCache = memoryStore.create({noPromises: true});

            memoryCache.load(data, err => {
                checkErr(err);
                assert.equal(memoryCache.get(key1), value1);
                assert.equal(memoryCache.get(key2), value2);
            });
        });

        it("lets us load data with callback", async function() {
            memoryCache = memoryStore.create();

            await memoryCache.load(data);

            assert.equal(await memoryCache.get(key1), value1);
            assert.equal(await memoryCache.get(key2), value2);
        });

    });
});
