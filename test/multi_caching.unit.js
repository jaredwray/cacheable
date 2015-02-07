var assert = require('assert');
var async = require('async');
var sinon = require('sinon');
var support = require('./support');
var checkErr = support.checkErr;
var caching = require('../index').caching;
var multiCaching = require('../index').multiCaching;
var memoryStore = require('../lib/stores/memory');

var methods = {
    getWidget: function(name, cb) {
        cb(null, {name: name});
    }
};

describe("multiCaching", function() {
    var memoryCache;
    var memoryCache2;
    var memoryCache3;
    var multiCache;
    var key;
    var memoryTtl;
    var name;
    var ttl = 5;

    beforeEach(function() {
        memoryTtl = 0.1;

        memoryCache = caching({store: 'memory', ttl: memoryTtl});
        memoryCache2 = caching({store: 'memory', ttl: memoryTtl});
        memoryCache3 = caching({store: 'memory', ttl: memoryTtl});

        key = support.random.string(20);
        name = support.random.string();
    });

    describe("get(), set(), del()", function() {
        var value;

        beforeEach(function() {
            multiCache = multiCaching([memoryCache, memoryCache2, memoryCache3]);
            key = support.random.string(20);
            value = support.random.string();
        });

        describe("set()", function() {
            it("lets us set data in all caches", function(done) {
                multiCache.set(key, value, ttl, function(err) {
                    checkErr(err);

                    memoryCache.get(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);

                        memoryCache2.get(key, function(err, result) {
                            checkErr(err);
                            assert.equal(result, value);

                            memoryCache3.get(key, function(err, result) {
                                checkErr(err);
                                assert.equal(result, value);
                                done();
                            });
                        });
                    });
                });
            });

            it("lets us set data without a callback", function(done) {
                multiCache.set(key, value, ttl);
                setTimeout(function() {
                    multiCache.get(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);

                        memoryCache.get(key, function(err, result) {
                            checkErr(err);
                            assert.equal(result, value);

                            memoryCache2.get(key, function(err, result) {
                                checkErr(err);
                                assert.equal(result, value);

                                memoryCache3.get(key, function(err, result) {
                                    checkErr(err);
                                    assert.equal(result, value);
                                    done();
                                });
                            });
                        });
                    });
                }, 20);
            });

            it("lets us set data without a ttl or callback", function(done) {
                multiCache.set(key, value);
                setTimeout(function() {
                    multiCache.get(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);

                        memoryCache.get(key, function(err, result) {
                            checkErr(err);
                            assert.equal(result, value);

                            memoryCache2.get(key, function(err, result) {
                                checkErr(err);
                                assert.equal(result, value);

                                memoryCache3.get(key, function(err, result) {
                                    checkErr(err);
                                    assert.equal(result, value);
                                    done();
                                });
                            });
                        });
                    });
                }, 20);
            });
        });

        describe("get()", function() {
            it("gets data from first cache that has it", function(done) {
                memoryCache3.set(key, value, ttl, function(err) {
                    checkErr(err);

                    multiCache.get(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);
                        done();
                    });
                });
            });
        });

        describe("del()", function() {
            it("lets us delete data in all caches", function(done) {
                multiCache.set(key, value, ttl, function(err) {
                    checkErr(err);

                    multiCache.del(key, function(err) {
                        checkErr(err);

                        memoryCache.get(key, function(err, result) {
                            assert.ok(!result);

                            memoryCache2.get(key, function(err, result) {
                                checkErr(err);
                                assert.ok(!result);

                                memoryCache3.get(key, function(err, result) {
                                    checkErr(err);
                                    assert.ok(!result);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            it("lets us delete data without a callback", function(done) {
                multiCache.set(key, value, ttl, function(err) {
                    checkErr(err);

                    multiCache.del(key);

                    setTimeout(function() {
                        memoryCache.get(key, function(err, result) {
                            checkErr(err);
                            assert.ok(!result);

                            memoryCache2.get(key, function(err, result) {
                                checkErr(err);
                                assert.ok(!result);

                                memoryCache3.get(key, function(err, result) {
                                    checkErr(err);
                                    assert.ok(!result);
                                    done();
                                });
                            });
                        });
                    }, 10);
                });
            });
        });
    });

    describe("getAndPassUp()", function() {
        var value;
        var key;

        describe("using a single cache store", function() {
            beforeEach(function() {
                multiCache = multiCaching([memoryCache3]);
                key = support.random.string(20);
                value = support.random.string();
            });

            it("gets data from first cache that has it", function(done) {
                memoryCache3.set(key, value, ttl, function(err) {
                    checkErr(err);

                    multiCache.getAndPassUp(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);
                        done();
                    });
                });
            });
        });

        describe("when value is not found in any cache", function() {
            var response;

            beforeEach(function(done) {
                key = support.random.string(10);
                sinon.spy(memoryCache, 'set');
                sinon.spy(memoryCache2, 'set');
                sinon.spy(memoryCache3, 'set');

                multiCache.getAndPassUp(key, function(err, result) {
                    checkErr(err);
                    response = result;
                    done();
                });
            });

            afterEach(function() {
                memoryCache.set.restore();
                memoryCache2.set.restore();
                memoryCache3.set.restore();
            });

            it("calls back with undefined", function() {
                assert.strictEqual(response, undefined);
            });

            it("does not set anything in caches", function(done) {
                process.nextTick(function() {
                    assert.ok(memoryCache.set.notCalled);
                    assert.ok(memoryCache2.set.notCalled);
                    assert.ok(memoryCache3.set.notCalled);
                    done();
                });
            });
        });

        describe("using multi cache store", function() {
            beforeEach(function() {
                multiCache = multiCaching([memoryCache, memoryCache2, memoryCache3]);
                key = support.random.string(20);
                value = support.random.string();
            });

            it("checks to see if higher levels have item", function(done) {
                memoryCache3.set(key, value, ttl, function(err) {
                    checkErr(err);

                    multiCache.getAndPassUp(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);

                        process.nextTick(function() {
                            memoryCache.get(key, function(err, result) {
                                assert.equal(result, value);
                                checkErr(err);
                                done();
                            });
                        });
                    });
                });
            });

            context("when a cache store calls back with an error", function() {
                var fakeError;
                var memoryStoreStub;

                beforeEach(function() {
                    memoryStoreStub = memoryStore.create({ttl: ttl});
                    sinon.stub(memoryStore, 'create').returns(memoryStoreStub);
                    memoryCache = caching({store: 'memory', ttl: ttl});
                    multiCache = multiCaching([memoryCache]);
                    fakeError = new Error(support.random.string());
                    sinon.stub(memoryStoreStub, 'get').yields(fakeError);
                });

                afterEach(function() {
                    memoryStore.create.restore();
                });

                it("bubbles up errors from caches", function(done) {
                    multiCache.getAndPassUp(key, function(err) {
                        assert.ok(memoryStoreStub.get.called);
                        assert.equal(err, fakeError);
                        done();
                    });
                });
            });
        });
    });

    describe("wrap()", function() {
        describe("using a single cache store", function() {
            beforeEach(function() {
                multiCache = multiCaching([memoryCache3]);
            });

            context("calls back with the result of a function", function() {
                beforeEach(function() {
                    sinon.spy(memoryCache3.store, 'set');
                });

                afterEach(function() {
                    memoryCache3.store.set.restore();
                });

                it('when a ttl number is passed in', function(done) {
                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, ttl, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memoryCache3.store.set, key, {name: name}, ttl);
                        done();
                    });
                });

                it('when a ttl option is passed in', function(done) {
                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, {ttl: ttl}, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memoryCache3.store.set, key, {name: name}, {ttl: ttl});
                        done();
                    });
                });

                it('when a ttl is not passed in', function(done) {
                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memoryCache3.store.set, key, {name: name});
                        done();
                    });
                });
            });

            context("when wrapped function calls back with an error", function() {
                it("calls back with that error", function(done) {
                    var fakeError = new Error(support.random.string());
                    sinon.stub(methods, 'getWidget', function(name, cb) {
                        cb(fakeError, {name: name});
                    });

                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, function(err, widget) {
                        methods.getWidget.restore();
                        assert.equal(err, fakeError);
                        assert.ok(!widget);
                        done();
                    });
                });
            });
        });

        describe("using two cache stores", function() {
            beforeEach(function() {
                multiCache = multiCaching([memoryCache, memoryCache3]);
            });

            it("calls back with the result of a function", function(done) {
                multiCache.wrap(key, function(cb) {
                    methods.getWidget(name, cb);
                }, function(err, widget) {
                    checkErr(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("sets value in all caches", function(done) {
                multiCache.wrap(key, function(cb) {
                    methods.getWidget(name, cb);
                }, function(err, widget) {
                    checkErr(err);
                    assert.deepEqual(widget, {name: name});

                    memoryCache.get(key, function(err, result) {
                        checkErr(err);
                        assert.deepEqual(result, {name: name});

                        memoryCache3.get(key, function(err, result) {
                            checkErr(err);
                            assert.deepEqual(result, {name: name});
                            done();
                        });
                    });
                });
            });

            context("when value exists in first store but not second", function() {
                it("returns value from first store, does not set it in second", function(done) {
                    memoryCache.set(key, {name: name}, ttl, function(err) {
                        checkErr(err);

                        multiCache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, function(err, widget) {
                            checkErr(err);
                            assert.deepEqual(widget, {name: name});

                            memoryCache3.get(key, function(err, result) {
                                checkErr(err);
                                assert.equal(result, null);
                                done();
                            });
                        });
                    });
                });
            });

            context("when value exists in second store but not first", function() {
                it("returns value from second store, sets it in first store", function(done) {
                    memoryCache3.set(key, {name: name}, ttl, function(err) {
                        checkErr(err);

                        multiCache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, function(err, widget) {
                            checkErr(err);
                            assert.deepEqual(widget, {name: name});

                            memoryCache.get(key, function(err, result) {
                                checkErr(err);
                                assert.deepEqual(result, {name: name});
                                done();
                            });
                        });
                    });
                });
            });
        });

        describe("using three cache stores", function() {
            beforeEach(function() {
                multiCache = multiCaching([memoryCache, memoryCache3, memoryCache2]);
            });

            it("calls back with the result of a function", function(done) {
                multiCache.wrap(key, function(cb) {
                    methods.getWidget(name, cb);
                }, function(err, widget) {
                    checkErr(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("sets value in all caches", function(done) {
                multiCache.wrap(key, function(cb) {
                    methods.getWidget(name, cb);
                }, function(err, widget) {
                    checkErr(err);
                    assert.deepEqual(widget, {name: name});

                    memoryCache.get(key, function(err, result) {
                        checkErr(err);
                        assert.deepEqual(result, {name: name});

                        memoryCache2.get(key, function(err, result) {
                            checkErr(err);
                            assert.deepEqual(result, {name: name});

                            memoryCache3.get(key, function(err, result) {
                                checkErr(err);
                                assert.deepEqual(result, {name: name});
                                done();
                            });
                        });
                    });
                });
            });

            context("when value exists in first store only", function() {
                it("returns value from first store, does not set it in second or third", function(done) {
                    memoryCache.set(key, {name: name}, ttl, function(err) {
                        checkErr(err);

                        multiCache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, function(err, widget) {
                            checkErr(err);
                            assert.deepEqual(widget, {name: name});

                            memoryCache2.get(key, function(err, result) {
                                checkErr(err);
                                assert.equal(result, null);

                                memoryCache3.get(key, function(err, result) {
                                    checkErr(err);
                                    assert.equal(result, null);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            context("when value exists in second store only", function() {
                it("returns value from second store, sets it in first store, does not set third store", function(done) {
                    memoryCache3.set(key, {name: name}, ttl, function(err) {
                        checkErr(err);

                        multiCache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, function(err, widget) {
                            checkErr(err);
                            assert.deepEqual(widget, {name: name});

                            memoryCache.get(key, function(err, result) {
                                checkErr(err);
                                assert.deepEqual(result, {name: name});

                                memoryCache2.get(key, function(err, result) {
                                    checkErr(err);
                                    assert.equal(result, null);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            context("when value exists in third store only", function() {
                it("returns value from third store, sets it in first and second stores", function(done) {
                    memoryCache2.set(key, {name: name}, ttl, function(err) {
                        checkErr(err);

                        multiCache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, function(err, widget) {
                            checkErr(err);
                            assert.deepEqual(widget, {name: name});

                            memoryCache3.get(key, function(err, result) {
                                checkErr(err);
                                assert.deepEqual(result, {name: name});

                                memoryCache.get(key, function(err, result) {
                                    checkErr(err);
                                    assert.deepEqual(result, {name: name});

                                    done();
                                });
                            });
                        });
                    });
                });
            });

            it("lets us make nested calls", function(done) {
                function getCachedWidget(name, cb) {
                    multiCache.wrap(key, function(cacheCb) {
                        methods.getWidget(name, cacheCb);
                    }, cb);
                }

                getCachedWidget(name, function(err, widget) {
                    checkErr(err);
                    assert.equal(widget.name, name);

                    getCachedWidget(name, function(err, widget) {
                        checkErr(err);
                        assert.equal(widget.name, name);

                        getCachedWidget(name, function(err, widget) {
                            checkErr(err);
                            assert.equal(widget.name, name);
                            done();
                        });
                    });
                });
            });
        });

        context("error handling", function() {
            var memoryStoreStub;
            var ttl;

            beforeEach(function() {
                ttl = 0.1;
                memoryStoreStub = memoryStore.create({ttl: ttl});
                sinon.stub(memoryStore, 'create').returns(memoryStoreStub);
                memoryCache = caching({store: 'memory', ttl: ttl});
                multiCache = multiCaching([memoryCache]);
            });

            afterEach(function() {
                memoryStore.create.restore();
            });

            context("when an error is thrown in the work function", function() {
                var fakeError;

                beforeEach(function() {
                    fakeError = new Error(support.random.string());
                });

                it("bubbles up that error", function(done) {
                    multiCache.wrap(key, function() {
                        throw fakeError;
                    }, ttl, function(err) {
                        assert.equal(err, fakeError);
                        done();
                    });
                });
            });

            context("when store.get() calls back with an error", function() {
                it("bubbles up that error", function(done) {
                    var fakeError = new Error(support.random.string());

                    sinon.stub(memoryStoreStub, 'get', function(key, cb) {
                        cb(fakeError);
                    });

                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, function(err) {
                        assert.equal(err, fakeError);
                        memoryStoreStub.get.restore();
                        done();
                    });
                });
            });

            context("when store.set() calls back with an error", function() {
                it("bubbles up that error", function(done) {
                    var fakeError = new Error(support.random.string());

                    sinon.stub(memoryStoreStub, 'set', function(key, val, ttl, cb) {
                        cb(fakeError);
                    });

                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, function(err) {
                        assert.equal(err, fakeError);
                        memoryStoreStub.set.restore();
                        done();
                    });
                });
            });
        });

        describe("when called multiple times in parallel with same key", function() {
            var construct;

            beforeEach(function() {
                multiCache = multiCaching([memoryCache, memoryCache3]);

                construct = sinon.spy(function(val, cb) {
                    var timeout = support.random.number(100);
                    setTimeout(function() {
                        cb(null, 'value');
                    }, timeout);
                });
            });

            it("calls the wrapped function once", function(done) {
                var values = [];
                for (var i = 0; i < 5; i++) {
                    values.push(i);
                }

                async.each(values, function(val, next) {
                    multiCache.wrap('key', function(cb) {
                        construct(val, cb);
                    }, function(err, result) {
                        assert.equal(result, 'value');
                        next(err);
                    });
                }, function(err) {
                    checkErr(err);
                    assert.equal(construct.callCount, 1);
                    done();
                });
            });
        });
    });

    context("when instantiated with a non-Array 'caches' arg", function() {
        it("throws an error", function() {
            assert.throws(function() {
                multiCaching({foo: 'bar'});
            }, /multiCaching requires an array/);
        });
    });
});
