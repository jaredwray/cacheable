// TODO: These are really a mix of unit and integration tests.

var assert = require('assert');
var async = require('async');
var sinon = require('sinon');
var support = require('./support');
var check_err = support.check_err;
var caching = require('../index').caching;
var memory_store = require('../lib/stores/memory');

var methods = {
    get_widget: function(name, cb) {
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
                        check_err(err);
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
                        check_err(err);
                        done();
                    });
                });

                it("deletes data from cache", function(done) {
                    cache.get(key, function(err, result) {
                        assert.equal(result, value);

                        cache.del(key, function(err) {
                            check_err(err);

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
                check_err(err);

                key2 = support.random.string(20);
                value2 = support.random.string();

                cache.set(key2, value2, ttl, done);
            });
        });

        it("clears the cache", function(done) {
            cache.reset(function(err) {
                check_err(err);

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
            var fake_store;

            beforeEach(function() {
                fake_store = {
                    get: function() {},
                    set: function() {},
                };
            });

            it("it doesn't throw an error", function() {
                assert.doesNotThrow(function() {
                    caching({store: fake_store});
                });
            });
        });
    });

    describe("setex()", function() {
        var fake_store;

        beforeEach(function() {
            fake_store = {
                get: function() {},
                set: function() {},
                del: function() {},
                setex: function() {}
            };

            sinon.stub(fake_store, 'setex');

            cache = caching({store: fake_store});
        });

        it("passes the params to the underlying store's setex() method", function() {
            cache.setex('foo', 'bar', 'blah');
            assert.ok(fake_store.setex.calledWith('foo', 'bar', 'blah'));
        });
    });

    describe("keys()", function() {
        var key_count;
        var saved_keys = [];

        beforeEach(function(done) {
            key_count = 10;
            var processed = 0;

            cache = caching({store: 'memory'});

            function is_done() {
                return processed === key_count;
            }

            async.until(is_done, function(cb) {
                processed += 1;
                key = support.random.string(20);
                saved_keys.push(key);
                value = support.random.string();
                cache.set(key, value, ttl, cb);
            }, done);
        });

        it("calls back with all keys in cache", function(done) {
            cache.keys(function(err, keys) {
                check_err(err);
                assert.deepEqual(keys.sort, saved_keys.sort);
                done();
            });
        });

        it("lets us get the keys without a callback (memory store only)", function() {
            var keys = cache.keys();
            assert.deepEqual(keys.sort, saved_keys.sort);
        });
    });

    describe("wrap()", function() {
        describe("using memory (lru-cache) store", function() {
            var memory_store_stub;

            beforeEach(function() {
                ttl = 0.1;
                memory_store_stub = memory_store.create({ttl: ttl});

                sinon.stub(memory_store, 'create').returns(memory_store_stub);

                cache = caching({store: 'memory', ttl: ttl, ignoreCacheErrors: false});
                key = support.random.string(20);
                name = support.random.string();
            });

            afterEach(function() {
                memory_store.create.restore();
            });

            context("calls back with the result of the wrapped function", function() {
                beforeEach(function() {
                    sinon.spy(memory_store_stub, 'set');
                });

                afterEach(function() {
                    memory_store_stub.set.restore();
                });

                it("when a ttl is passed in", function(done) {
                    cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, ttl, function(err, widget) {
                        check_err(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memory_store_stub.set, key, {name: name}, ttl);
                        done();
                    });
                });

                it("when a ttl is not passed in", function(done) {
                    cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, function(err, widget) {
                        check_err(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memory_store_stub.set, key, {name: name}, undefined);
                        done();
                    });
                });
            });

            context("when result is already cached", function() {
                function get_cached_widget(name, cb) {
                    cache.wrap(key, function(cache_cb) {
                        methods.get_widget(name, cache_cb);
                    }, ttl, cb);
                }

                beforeEach(function(done) {
                    get_cached_widget(name, function(err, widget) {
                        check_err(err);
                        assert.ok(widget);

                        memory_store_stub.get(key, function(err, result) {
                            check_err(err);
                            assert.ok(result);

                            sinon.spy(memory_store_stub, 'get');

                            done();
                        });
                    });
                });

                afterEach(function() {
                    memory_store_stub.get.restore();
                });

                it("retrieves data from cache", function(done) {
                    var func_called = false;

                    cache.wrap(key, function(cb) {
                        methods.get_widget(name, function(err, result) {
                            func_called = true;
                            cb(err, result);
                        });
                    }, ttl, function(err, widget) {
                        check_err(err);
                        assert.deepEqual(widget, {name: name});
                        assert.ok(memory_store_stub.get.calledWith(key));
                        assert.ok(!func_called);
                        done();
                    });
                });
            });

            it("expires cached result after ttl seconds", function(done) {
                cache.wrap(key, function(cb) {
                    methods.get_widget(name, cb);
                }, ttl, function(err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});

                    memory_store_stub.get(key, function(err, result) {
                        check_err(err);
                        assert.ok(result);

                        var func_called = false;

                        setTimeout(function() {
                            cache.wrap(key, function(cb) {
                                methods.get_widget(name, function(err, result) {
                                    func_called = true;
                                    cb(err, result);
                                });
                            }, function(err, widget) {
                                check_err(err);
                                assert.ok(func_called);
                                assert.deepEqual(widget, {name: name});
                                done();
                            });
                        }, (ttl * 1000 + 10));
                    });
                });
            });

            context("when an error is thrown in the work function", function() {
                var fake_error;

                beforeEach(function() {
                    fake_error = new Error(support.random.string());
                });

                it("bubbles up that error", function(done) {
                    cache.wrap(key, function() {
                        throw fake_error;
                    }, ttl, function(err) {
                        assert.equal(err, fake_error);
                        done();
                    });
                });
            });

            context("when store.get() calls back with an error", function() {
                context("and ignoreCacheErrors is not set (default is false)", function() {
                    it("bubbles up that error", function(done) {
                        var fake_error = new Error(support.random.string());

                        sinon.stub(memory_store_stub, 'get', function(key, cb) {
                            cb(fake_error);
                        });

                        cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, fake_error);
                            memory_store_stub.get.restore();
                            done();
                        });
                    });
                });

                context("and ignoreCacheErrors is set to true", function() {
                    it("does not bubble up that error", function(done) {
                        cache = caching({store: 'memory', ttl: ttl, ignoreCacheErrors: true});

                        var fake_error = new Error(support.random.string());

                        sinon.stub(memory_store_stub, 'get', function(key, cb) {
                            cb(fake_error);
                        });

                        cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, null);
                            memory_store_stub.get.restore();
                            done();
                        });
                    });
                });
            });

            context("when store.set() calls back with an error", function() {
                context("and ignoreCacheErrors is not set", function() {
                    it("bubbles up that error", function(done) {
                        var fake_error = new Error(support.random.string());

                        sinon.stub(memory_store_stub, 'set', function(key, val, ttl, cb) {
                            cb(fake_error);
                        });

                        cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, fake_error);
                            memory_store_stub.set.restore();
                            done();
                        });
                    });
                });

                context("and ignoreCacheErrors is set to true", function() {
                    it("does not bubbles up that error", function(done) {
                        cache = caching({store: 'memory', ttl: ttl, ignoreCacheErrors: true});
                        var fake_error = new Error(support.random.string());

                        sinon.stub(memory_store_stub, 'set', function(key, val, ttl, cb) {
                            cb(fake_error);
                        });

                        cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, ttl, function(err) {
                            assert.equal(err, null);
                            memory_store_stub.set.restore();
                            done();
                        });
                    });
                });
            });

            context("when wrapped function calls back with an error", function() {
                it("calls back with that error", function(done) {
                    var fake_error = new Error(support.random.string());
                    sinon.stub(methods, 'get_widget', function(name, cb) {
                        cb(fake_error, {name: name});
                    });

                    cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, ttl, function(err, widget) {
                        methods.get_widget.restore();
                        assert.equal(err, fake_error);
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

                async.each(values, function(val, async_cb) {
                    cache.wrap('key', function(cb) {
                        construct(val, cb);
                    }, ttl, function(err, result) {
                        assert.equal(result, 'value');
                        async_cb(err);
                    });
                }, function(err) {
                    check_err(err);
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
            var store = memory_store.create({ttl: ttl});
            cache = caching({store: store});
            cache.set(key, value, ttl, function(err) {
                check_err(err);
                cache.get(key, function(err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });

        it("allows us to pass in a path to our own store", function(done) {
            var store_path = '../lib/stores/memory';
            cache = caching({store: store_path});
            cache.set(key, value, ttl, function(err) {
                check_err(err);
                cache.get(key, function(err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });

        it("allows us to pass in a module (uninstantiated)", function(done) {
            var store = memory_store;
            cache = caching({store: store});
            cache.set(key, value, ttl, function(err) {
                check_err(err);
                cache.get(key, function(err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });
    });
});
