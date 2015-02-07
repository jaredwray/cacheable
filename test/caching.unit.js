// TODO: These are really a mix of unit and integration tests.

var assert = require('assert');
var async = require('async');
var sinon = require('sinon');
var support = require('./support');
var checkErr = support.checkErr;
var caching = require('../index').caching;
var memoryStore = require('../lib/stores/memory');

var methods = {
    getWidget: function(name, cb) {
        cb(null, {name: name});
    }
};

describe("caching", function() {
    var cache;
    var key;
    var ttl = 1;
    var name;
    var value;

    describe("get() and set()", function() {
        ['memory'].forEach(function(store) {
            context("using " + store + " store", function() {
                beforeEach(function() {
                    cache = caching({store: store});
                    key = support.random.string(20);
                    value = support.random.string();
                });

                it("lets us set and get data in cache", function(done) {
                    cache.set(key, value, ttl, function(err) {
                        checkErr(err);
                        cache.get(key, function(err, result) {
                            assert.equal(result, value);
                            done();
                        });
                    });
                });

                it("lets us set and get data without a callback", function(done) {
                    cache.set(key, value, ttl);
                    setTimeout(function() {
                        var result = cache.get(key);
                        assert.equal(result, value);
                        done();
                    }, 20);
                });

                it("lets us set and get data without a ttl or callback", function(done) {
                    cache.set(key, value);
                    setTimeout(function() {
                        var result = cache.get(key);
                        assert.equal(result, value);
                        done();
                    }, 20);
                });
            });
        });
    });

    describe("del()", function() {
        ['memory'].forEach(function(store) {
            context("using " + store + " store", function() {
                beforeEach(function(done) {
                    cache = caching({store: store});
                    key = support.random.string(20);
                    value = support.random.string();
                    cache.set(key, value, ttl, function(err) {
                        checkErr(err);
                        done();
                    });
                });

                it("deletes data from cache", function(done) {
                    cache.get(key, function(err, result) {
                        assert.equal(result, value);

                        cache.del(key, function(err) {
                            checkErr(err);

                            cache.get(key, function(err, result) {
                                assert.ok(!result);
                                done();
                            });
                        });
                    });
                });

                it("lets us delete data without a callback", function(done) {
                    cache.get(key, function(err, result) {
                        assert.equal(result, value);

                        cache.del(key);

                        setTimeout(function() {
                            cache.get(key, function(err, result) {
                                assert.ok(!result);
                                done();
                            });
                        }, 20);
                    });
                });
            });
        });
    });

    describe("reset()", function() {
        var key2;
        var value2;

        beforeEach(function(done) {
            cache = caching({store: 'memory'});
            key = support.random.string(20);
            value = support.random.string();
            cache.set(key, value, ttl, function(err) {
                checkErr(err);

                key2 = support.random.string(20);
                value2 = support.random.string();

                cache.set(key2, value2, ttl, done);
            });
        });

        it("clears the cache", function(done) {
            cache.reset(function(err) {
                checkErr(err);

                cache.get(key, function(err, result) {
                    assert.ok(!result);

                    cache.get(key2, function(err, result) {
                        assert.ok(!result);
                        done();
                    });
                });
            });
        });

        it("lets us clear the cache without a callback (memory store only)", function(done) {
            cache.reset();
            setTimeout(function() {
                cache.get(key, function(err, result) {
                    assert.ok(!result);

                    cache.get(key2, function(err, result) {
                        assert.ok(!result);
                        done();
                    });
                });
            }, 10);
        });

        context("when store has no del() method", function() {
            var fakeStore;

            beforeEach(function() {
                fakeStore = {
                    get: function() {},
                    set: function() {},
                };
            });

            it("it doesn't throw an error", function() {
                assert.doesNotThrow(function() {
                    caching({store: fakeStore});
                });
            });
        });
    });

    describe("setex()", function() {
        var fakeStore;

        beforeEach(function() {
            fakeStore = {
                get: function() {},
                set: function() {},
                del: function() {},
                setex: function() {}
            };

            sinon.stub(fakeStore, 'setex');

            cache = caching({store: fakeStore});
        });

        it("passes the params to the underlying store's setex() method", function() {
            cache.setex('foo', 'bar', 'blah');
            assert.ok(fakeStore.setex.calledWith('foo', 'bar', 'blah'));
        });
    });

    describe("ttl()", function() {
        var fakeStore;

        beforeEach(function() {
            fakeStore = {
                get: function() {},
                set: function() {},
                del: function() {},
                ttl: function() {}
            };

            sinon.stub(fakeStore, 'ttl');

            cache = caching({store: fakeStore});
        });

        it("passes the params to the underlying store's ttl() method", function() {
            cache.ttl('foo');
            assert.ok(fakeStore.ttl.calledWith('foo'));
        });
    });

    describe("keys()", function() {
        var keyCount;
        var savedKeys = [];

        beforeEach(function(done) {
            keyCount = 10;
            var processed = 0;

            cache = caching({store: 'memory'});

            function isDone() {
                return processed === keyCount;
            }

            async.until(isDone, function(cb) {
                processed += 1;
                key = support.random.string(20);
                savedKeys.push(key);
                value = support.random.string();
                cache.set(key, value, ttl, cb);
            }, done);
        });

        it("calls back with all keys in cache", function(done) {
            cache.keys(function(err, keys) {
                checkErr(err);
                assert.deepEqual(keys.sort, savedKeys.sort);
                done();
            });
        });

        it("lets us get the keys without a callback (memory store only)", function() {
            var keys = cache.keys();
            assert.deepEqual(keys.sort, savedKeys.sort);
        });
    });

    describe("wrap()", function() {
        describe("using memory (lru-cache) store", function() {
            var memoryStoreStub;

            beforeEach(function() {
                ttl = 0.1;
                memoryStoreStub = memoryStore.create({ttl: ttl});

                sinon.stub(memoryStore, 'create').returns(memoryStoreStub);

                cache = caching({store: 'memory', ttl: ttl, ignoreCacheErrors: false});
                key = support.random.string(20);
                name = support.random.string();
            });

            afterEach(function() {
                memoryStore.create.restore();
            });

            context("calls back with the result of the wrapped function", function() {
                beforeEach(function() {
                    sinon.spy(memoryStoreStub, 'set');
                });

                afterEach(function() {
                    memoryStoreStub.set.restore();
                });

                it("when a ttl is passed in", function(done) {
                    cache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, ttl, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memoryStoreStub.set, key, {name: name}, ttl);
                        done();
                    });
                });

                it("when a ttl is not passed in", function(done) {
                    cache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memoryStoreStub.set, key, {name: name}, undefined);
                        done();
                    });
                });
            });

            context("when result is already cached", function() {
                function getCachedWidget(name, cb) {
                    cache.wrap(key, function(cacheCb) {
                        methods.getWidget(name, cacheCb);
                    }, ttl, cb);
                }

                beforeEach(function(done) {
                    getCachedWidget(name, function(err, widget) {
                        checkErr(err);
                        assert.ok(widget);

                        memoryStoreStub.get(key, function(err, result) {
                            checkErr(err);
                            assert.ok(result);

                            sinon.spy(memoryStoreStub, 'get');

                            done();
                        });
                    });
                });

                afterEach(function() {
                    memoryStoreStub.get.restore();
                });

                it("retrieves data from cache", function(done) {
                    var funcCalled = false;

                    cache.wrap(key, function(cb) {
                        methods.getWidget(name, function(err, result) {
                            funcCalled = true;
                            cb(err, result);
                        });
                    }, ttl, function(err, widget) {
                        checkErr(err);
                        assert.deepEqual(widget, {name: name});
                        assert.ok(memoryStoreStub.get.calledWith(key));
                        assert.ok(!funcCalled);
                        done();
                    });
                });
            });

            it("lets us make nested calls", function(done) {
                function getCachedWidget(name, cb) {
                    cache.wrap(key, function(cacheCb) {
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

            it("expires cached result after ttl seconds", function(done) {
                cache.wrap(key, function(cb) {
                    methods.getWidget(name, cb);
                }, ttl, function(err, widget) {
                    checkErr(err);
                    assert.deepEqual(widget, {name: name});

                    memoryStoreStub.get(key, function(err, result) {
                        checkErr(err);
                        assert.ok(result);

                        var funcCalled = false;

                        setTimeout(function() {
                            cache.wrap(key, function(cb) {
                                methods.getWidget(name, function(err, result) {
                                    funcCalled = true;
                                    cb(err, result);
                                });
                            }, function(err, widget) {
                                checkErr(err);
                                assert.ok(funcCalled);
                                assert.deepEqual(widget, {name: name});
                                done();
                            });
                        }, (ttl * 1000 + 10));
                    });
                });
            });

            context("when an error is thrown in the work function", function() {
                var fakeError;

                beforeEach(function() {
                    fakeError = new Error(support.random.string());
                });

                it("bubbles up that error", function(done) {
                    cache.wrap(key, function() {
                        throw fakeError;
                    }, ttl, function(err) {
                        assert.equal(err, fakeError);
                        done();
                    });
                });
            });

            context("when store.get() calls back with an error", function() {
                context("and ignoreCacheErrors is not set (default is false)", function() {
                    it("bubbles up that error", function(done) {
                        var fakeError = new Error(support.random.string());

                        sinon.stub(memoryStoreStub, 'get', function(key, options, cb) {
                            cb(fakeError);
                        });

                        cache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, fakeError);
                            memoryStoreStub.get.restore();
                            done();
                        });
                    });
                });

                context("and ignoreCacheErrors is set to true", function() {
                    it("does not bubble up that error", function(done) {
                        cache = caching({store: 'memory', ttl: ttl, ignoreCacheErrors: true});

                        var fakeError = new Error(support.random.string());

                        sinon.stub(memoryStoreStub, 'get', function(key, options, cb) {
                            cb(fakeError);
                        });

                        cache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, null);
                            memoryStoreStub.get.restore();
                            done();
                        });
                    });
                });
            });

            context("when store.set() calls back with an error", function() {
                context("and ignoreCacheErrors is not set", function() {
                    it("bubbles up that error", function(done) {
                        var fakeError = new Error(support.random.string());

                        sinon.stub(memoryStoreStub, 'set', function(key, val, ttl, cb) {
                            cb(fakeError);
                        });

                        cache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, fakeError);
                            memoryStoreStub.set.restore();
                            done();
                        });
                    });
                });

                context("and ignoreCacheErrors is set to true", function() {
                    it("does not bubbles up that error", function(done) {
                        cache = caching({store: 'memory', ttl: ttl, ignoreCacheErrors: true});
                        var fakeError = new Error(support.random.string());

                        sinon.stub(memoryStoreStub, 'set', function(key, val, ttl, cb) {
                            cb(fakeError);
                        });

                        cache.wrap(key, function(cb) {
                            methods.getWidget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, null);
                            memoryStoreStub.set.restore();
                            done();
                        });
                    });
                });
            });

            context("when wrapped function calls back with an error", function() {
                it("calls back with that error", function(done) {
                    var fakeError = new Error(support.random.string());
                    sinon.stub(methods, 'getWidget', function(name, cb) {
                        cb(fakeError, {name: name});
                    });

                    cache.wrap(key, function(cb) {
                        methods.getWidget(name, cb);
                    }, ttl, function(err, widget) {
                        methods.getWidget.restore();
                        assert.equal(err, fakeError);
                        assert.ok(!widget);
                        done();
                    });
                });
            });
        });

        describe("when called multiple times in parallel with same key", function() {
            var construct;

            beforeEach(function() {
                cache = caching({
                    store: 'memory',
                    max: 50,
                    ttl: 5 * 60
                });

                construct = sinon.spy(function(val, cb) {
                    var timeout = support.random.number(100);
                    setTimeout(function() {
                        cb(null, 'value');
                    }, timeout);
                });
            });

            it("calls the wrapped function once", function(done) {
                var values = [];
                for (var i = 0; i < 2; i++) {
                    values.push(i);
                }

                async.each(values, function(val, next) {
                    cache.wrap('key', function(cb) {
                        construct(val, cb);
                    }, ttl, function(err, result) {
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

    describe("instantiating with no store passed in", function() {
        it("defaults to 'memory' store", function() {
            var cache = caching();
            assert.equal(cache.store.name, 'memory');
        });
    });

    describe("instantiating with custom store", function() {
        it("allows us to pass in our own store object", function(done) {
            var store = memoryStore.create({ttl: ttl});
            cache = caching({store: store});
            cache.set(key, value, ttl, function(err) {
                checkErr(err);
                cache.get(key, function(err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });

        it("allows us to pass in a path to our own store", function(done) {
            var storePath = '../lib/stores/memory';
            cache = caching({store: storePath});
            cache.set(key, value, ttl, function(err) {
                checkErr(err);
                cache.get(key, function(err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });

        it("allows us to pass in a module (uninstantiated)", function(done) {
            var store = memoryStore;
            cache = caching({store: store});
            cache.set(key, value, ttl, function(err) {
                checkErr(err);
                cache.get(key, function(err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });
    });
});
