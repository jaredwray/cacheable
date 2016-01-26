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
        process.nextTick(function() {
            cb(null, {name: name});
        });
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
    var defaultTtl;

    beforeEach(function() {
        memoryTtl = 0.1;
        defaultTtl = 5;

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
                multiCache.set(key, value, {ttl: defaultTtl}, function(err) {
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
                multiCache.set(key, value, {ttl: defaultTtl});
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

            it("lets us set data without an options param", function(done) {
                multiCache.set(key, value, function(err) {
                    checkErr(err);

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
                });
            });

            it("lets us set data without options or callback", function(done) {
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
                memoryCache3.set(key, value, function(err) {
                    checkErr(err);

                    multiCache.get(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);
                        done();
                    });
                });
            });

            it("passes any options to underlying caches", function(done) {
                multiCache.set(key, value, function(err) {
                    checkErr(err);

                    sinon.spy(memoryCache.store, 'get');

                    var opts = {foo: 'bar'};

                    multiCache.get(key, opts, function(err, result) {
                        checkErr(err);

                        assert.equal(result, value);
                        assert.ok(memoryCache.store.get.calledWith(key, opts));

                        memoryCache.store.get.restore();
                        done();
                    });
                });
            });

            describe('using promises', function() {
                it('gets data from first cache that has it', function(done) {
                    memoryCache3.set(key, value)
                    .then(function() {
                        return multiCache.get(key);
                    })
                    .then(function(result) {
                        assert.equal(result, value);
                    })
                    .then(done);
                });

                it("passes any options to underlying caches", function(done) {
                    var opts = {foo: 'bar'};

                    multiCache.set(key, value)
                    .then(function() {
                        sinon.spy(memoryCache.store, 'get');
                        return multiCache.get(key, opts);
                    })
                    .then(function(result) {
                        assert.equal(result, value);
                        assert.ok(memoryCache.store.get.calledWith(key, opts));

                        memoryCache.store.get.restore();
                    })
                    .then(done);
                });
            });
        });

        describe("del()", function() {
            it("lets us delete data in all caches", function(done) {
                multiCache.set(key, value, function(err) {
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
                multiCache.set(key, value, function(err) {
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
                memoryCache3.set(key, value, function(err) {
                    checkErr(err);

                    multiCache.getAndPassUp(key, function(err, result) {
                        checkErr(err);
                        assert.equal(result, value);
                        done();
                    });
                });
            });

            it("gets data from first cache that has it using promises", function(done) {
                memoryCache3.set(key, value)
                .then(function() {
                    return multiCache.getAndPassUp(key);
                })
                .then(function(result) {
                    assert.equal(result, value);
                    done();
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
                memoryCache3.set(key, value, function(err) {
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

            it("checks to see if higher levels have item using promises", function(done) {
                memoryCache3.set(key, value)
                .then(function() {
                    return multiCache.getAndPassUp(key);
                })
                .then(function(result) {
                    assert.equal(result, value);
                })
                .then(function() {
                    process.nextTick(function() {
                        assert.equal(memoryCache.get(key), value);
                    });
                })
                .then(done);
            });

            context("when a cache store calls back with an error", function() {
                var fakeError;
                var memoryStoreStub;

                beforeEach(function() {
                    memoryStoreStub = memoryStore.create({ttl: defaultTtl});
                    sinon.stub(memoryStore, 'create').returns(memoryStoreStub);
                    memoryCache = caching({store: 'memory', ttl: defaultTtl});
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

                it("bubbles up errors from caches and reject promise", function(done) {
                    multiCache.getAndPassUp(key)
                    .catch(function(err) {
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

                /**
                 * Note: it's up to the underlying cache implementation to handle the ttl number.
                 * We're just testing that the ttl gets passed to the underlying store.
                 */
                it('when a ttl number is passed in', function(done) {
                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, defaultTtl, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memoryCache3.store.set, key, {name: name}, defaultTtl);
                        done();
                    });
                });

                it('when a ttl option is passed in', function(done) {
                    multiCache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, {ttl: defaultTtl}, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memoryCache3.store.set, key, {name: name}, {ttl: defaultTtl});

                        done();
                    });
                });

                it('when no options are passed in', function(done) {
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
                    sinon.stub(methods, 'getWidget').yields(fakeError, {name: name});

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

            var falseyValues = [false, null, 0];

            falseyValues.forEach(function(falseyValue) {
                context("when cached value is `" + falseyValue + "`", function() {
                    function getFalseyValue(cb) {
                        process.nextTick(function() {
                            cb(null, falseyValue);
                        });
                    }

                    function getCachedFalseyValue(cb) {
                        multiCache.wrap(key, function(cacheCb) {
                            getFalseyValue(cacheCb);
                        }, cb);
                    }

                    beforeEach(function(done) {
                        multiCache = multiCaching([memoryCache3]);
                        sinon.spy(memoryCache3.store, 'set');

                        getCachedFalseyValue(function(err, result) {
                            checkErr(err);
                            assert.strictEqual(result, falseyValue);

                            memoryCache3.get(key, function(err, result) {
                                checkErr(err);
                                assert.strictEqual(result, falseyValue);

                                sinon.spy(memoryCache3.store, 'get');

                                done();
                            });
                        });
                    });

                    afterEach(function() {
                        memoryCache3.store.set.restore();
                        memoryCache3.store.get.restore();
                    });

                    it("sets data in and retrieves data from cache", function(done) {
                        getCachedFalseyValue(function(err, value) {
                            checkErr(err);
                            assert.strictEqual(value, falseyValue);
                            assert.ok(memoryCache3.store.set.calledWith(key));
                            assert.ok(memoryCache3.store.get.calledWith(key));
                            done();
                        });
                    });
                });
            });

            context("when we pass in an isCacheableValue function to the caching constructor", function() {
                var testCallbacks = {
                    isCacheableValue: function(value) {
                        return value !== 'do_not_store_this' && value !== undefined;
                    }
                };

                function getValue(name, cb) {
                    process.nextTick(function() {
                        if (name === 'foo') {
                            cb(null, 'store_this');
                        } else {
                            cb(null, 'do_not_store_this');
                        }
                    });
                }

                function getCachedValue(name, cb) {
                    multiCache.wrap(key, function(cacheCb) {
                        getValue(name, function(err, result) {
                            cacheCb(err, result);
                        });
                    }, cb);
                }

                beforeEach(function() {
                    sinon.spy(testCallbacks, 'isCacheableValue');
                    multiCache = multiCaching([memoryCache3], {isCacheableValue: testCallbacks.isCacheableValue});
                    sinon.spy(memoryCache3.store, 'set');
                });

                afterEach(function() {
                    memoryCache3.store.set.restore();
                    testCallbacks.isCacheableValue.restore();
                });

                it("stores allowed values", function(done) {
                    var name = 'foo';

                    getCachedValue(name, function(err) {
                        checkErr(err);
                        assert.ok(memoryCache3.store.set.called);

                        assert.ok(testCallbacks.isCacheableValue.called);

                        getCachedValue(name, function(err) {
                            checkErr(err);
                            done();
                        });
                    });
                });

                it("does not store non-allowed values", function(done) {
                    var name = 'bar';

                    getCachedValue(name, function(err) {
                        checkErr(err);
                        assert.ok(memoryCache3.store.set.notCalled);
                        done();
                    });
                });
            });

            context("when an underlying store has its own isCacheableValue function", function() {
                var memoryCache4;

                var testCallbacks = {
                    isCacheableValue: function(value) {
                        var x = value !== 'do_not_store_this' && value !== undefined;
                        return x;
                    }
                };

                function getValue(name, cb) {
                    process.nextTick(function() {
                        if (name === 'foo') {
                            cb(null, 'store_this');
                        } else {
                            cb(null, 'do_not_store_this');
                        }
                    });
                }

                function getCachedValue(name, cb) {
                    multiCache.wrap(key, function(cacheCb) {
                        getValue(name, function(err, result) {
                            cacheCb(err, result);
                        });
                    }, cb);
                }

                beforeEach(function() {
                    sinon.spy(testCallbacks, 'isCacheableValue');
                    memoryCache4 = caching({
                        store: 'memory',
                        ttl: memoryTtl
                    });

                    // This simulates how node-cache-manager-redis sets its
                    // isCacheableValue function:
                    memoryCache4.store.isCacheableValue = testCallbacks.isCacheableValue;

                    multiCache = multiCaching([memoryCache4]);
                    sinon.spy(memoryCache4.store, 'set');
                });

                afterEach(function() {
                    memoryCache4.store.set.restore();
                    testCallbacks.isCacheableValue.restore();
                });

                it("stores allowed values", function(done) {
                    var name = 'foo';

                    getCachedValue(name, function(err) {
                        checkErr(err);
                        assert.ok(memoryCache4.store.set.called);

                        assert.ok(testCallbacks.isCacheableValue.called);

                        getCachedValue(name, function(err) {
                            checkErr(err);
                            done();
                        });
                    });
                });

                it("does not store non-allowed values", function(done) {
                    var name = 'bar';

                    getCachedValue(name, function(err) {
                        checkErr(err);
                        assert.ok(memoryCache4.store.set.notCalled);
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
                    memoryCache.set(key, {name: name}, function(err) {
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
                    memoryCache3.set(key, {name: name}, function(err) {
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
                    memoryCache.set(key, {name: name}, function(err) {
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
                    memoryCache3.set(key, {name: name}, function(err) {
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
                    memoryCache2.set(key, {name: name}, function(err) {
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

            context("when an error is thrown in the work function's callback", function() {
                var fakeError;

                beforeEach(function() {
                    fakeError = new Error(support.random.string());
                });

                it("bubbles up that error", function(done) {
                    multiCache.wrap(key, function(next) {
                        next();
                    }, ttl, function() {
                        // This test as-is doesn't prove a fix for #28 (https://github.com/BryanDonovan/node-cache-manager/issues/28)
                        // but if you remove the try/catch, it shows that the undefined `waiting` array issue
                        // is no longer present (the domain doesn't try to process the error in the callbackFiller).
                        try {
                            throw new Error('foo');
                        } catch (e) {
                            assert.equal(e.message, 'foo');
                        }

                        done();
                    });
                });
            });

            context("when store.get() calls back with an error", function() {
                it("bubbles up that error", function(done) {
                    var fakeError = new Error(support.random.string());

                    sinon.stub(memoryStoreStub, 'get').yields(fakeError);

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

                    sinon.stub(memoryStoreStub, 'set').yields(fakeError);

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
                var firstTimeout = 110;
                var firstTimeoutUsed = false;

                function getTimeout() {
                    if (firstTimeoutUsed) {
                        support.random.number(100);
                    } else {
                        firstTimeoutUsed = true;
                        return firstTimeout;
                    }
                }

                construct = sinon.spy(function(val, cb) {
                    var timeout = getTimeout();
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

        describe("using native promises", function() {
            beforeEach(function() {
                multiCache = multiCaching([memoryCache, memoryCache3]);
            });

            it("should be able to chain with simple promise", function(done) {
                multiCache.wrap('key', function() {
                    return 'OK';
                })
                .then(function(res) {
                    assert.equal(res, 'OK');
                    done();
                });
            });

            it("should be able to chain with cache function as a promise", function(done) {
                multiCache.wrap('key', function() {
                    return new Promise(function(resolve) {
                        resolve('OK');
                    });
                })
                .then(function(res) {
                    assert.equal(res, 'OK');
                    done();
                });
            });

            it("should be able to catch errors in cache function as a promise", function(done) {
                multiCache.wrap('key', function() {
                    return new Promise(function(resolve, reject) {
                        reject('NOK');
                    });
                })
                .then(function() {
                    done(new Error('It should not call then since there is an error in the cache function!'));
                })
                .catch(function() {
                    done();
                });
            });

            it("should be able to catch a throw in cache function as a promise", function(done) {
                multiCache.wrap('key', function() {
                    throw 'NOK';
                })
                .then(function() {
                    done(new Error('It should not call then since there is an error in the cache function!'));
                })
                .catch(function() {
                    done();
                });
            });

            it("should be able to chain with non-cacheable value", function(done) {
                multiCache.wrap('key', function() {
                    return;
                })
                .then(function(res) {
                    assert.equal(res, undefined);
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
