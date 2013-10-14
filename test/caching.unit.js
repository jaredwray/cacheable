var assert = require('assert');
var sinon = require('sinon');
var support = require('./support');
var check_err = support.check_err;
var caching = require('../index').caching;
var memory_store = require('../lib/stores/memory');

var methods = {
    get_widget: function (name, cb) {
        cb(null, {name: name});
    }
};

describe("caching", function () {
    var cache;
    var key;
    var ttl;
    var name;
    var value;

    describe("get() and set()", function () {
        ['memory'].forEach(function (store) {
            context("using " + store + " store", function () {
                beforeEach(function () {
                    cache = caching({store: store});
                    key = support.random.string(20);
                    value = support.random.string();
                });

                it("lets us set and get data in cache", function (done) {
                    cache.set(key, value, function (err) {
                        check_err(err);
                        cache.get(key, function (err, result) {
                            assert.equal(result, value);
                            done();
                        });
                    });
                });

                it("lets us set data without a callback", function (done) {
                    cache.set(key, value);
                    setTimeout(function () {
                        cache.get(key, function (err, result) {
                            assert.equal(result, value);
                            done();
                        });
                    }, 20);
                });
            });
        });
    });

    describe("del()", function () {
        ['memory'].forEach(function (store) {
            context("using " + store + " store", function () {
                beforeEach(function (done) {
                    cache = caching({store: store});
                    key = support.random.string(20);
                    value = support.random.string();
                    cache.set(key, value, function (err) {
                        check_err(err);
                        done();
                    });
                });

                it("deletes data from cache", function (done) {
                    cache.get(key, function (err, result) {
                        assert.equal(result, value);

                        cache.del(key, function (err) {
                            check_err(err);

                            cache.get(key, function (err, result) {
                                assert.ok(!result);
                                done();
                            });
                        });
                    });
                });

                it("lets us delete data without a callback", function (done) {
                    cache.get(key, function (err, result) {
                        assert.equal(result, value);

                        cache.del(key);

                        setTimeout(function () {
                            cache.get(key, function (err, result) {
                                assert.ok(!result);
                                done();
                            });
                        }, 20);
                    });
                });
            });
        });
    });

    describe("wrap()", function () {
        describe("using memory (lru-cache) store", function () {
            var memory_store_stub;

            beforeEach(function () {
                ttl = 0.1;
                memory_store_stub = memory_store.create({ttl: ttl});

                sinon.stub(memory_store, 'create').returns(memory_store_stub);

                cache = caching({store: 'memory', ttl: ttl});
                key = support.random.string(20);
                name = support.random.string();
            });

            afterEach(function () {
                memory_store.create.restore();
            });

            it("calls back with the result of a function", function (done) {
                cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("retrieves data from memory when available", function (done) {
                cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.ok(widget);

                    memory_store_stub.get(key, function (err, result) {
                        check_err(err);
                        assert.ok(result);

                        sinon.spy(memory_store_stub, 'get');
                        var func_called = false;

                        cache.wrap(key, function (cb) {
                            methods.get_widget(name, function (err, result) {
                                func_called = true;
                                cb(err, result);
                            });
                        }, function (err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});
                            assert.ok(memory_store_stub.get.calledWith(key));
                            assert.ok(!func_called);
                            memory_store_stub.get.restore();
                            done();
                        });
                    });
                });
            });

            it("expires cached result after ttl seconds", function (done) {
                cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});

                    memory_store_stub.get(key, function (err, result) {
                        check_err(err);
                        assert.ok(result);

                        var func_called = false;

                        setTimeout(function () {
                            cache.wrap(key, function (cb) {
                                methods.get_widget(name, function (err, result) {
                                    func_called = true;
                                    cb(err, result);
                                });
                            }, function (err, widget) {
                                check_err(err);
                                assert.ok(func_called);
                                assert.deepEqual(widget, {name: name});
                                done();
                            });
                        }, (ttl * 1000 + 10));
                    });
                });
            });

            context("when store.get() calls back with an error", function () {
                it("bubbles up that error", function (done) {
                    var fake_error = new Error(support.random.string());

                    sinon.stub(memory_store_stub, 'get', function (key, cb) {
                        cb(fake_error);
                    });

                    cache.wrap(key, function (cb) {
                        methods.get_widget(name, cb);
                    }, function (err) {
                        assert.equal(err, fake_error);
                        memory_store_stub.get.restore();
                        done();
                    });
                });
            });

            context("when store.set() calls back with an error", function () {
                it("bubbles up that error", function (done) {
                    var fake_error = new Error(support.random.string());

                    sinon.stub(memory_store_stub, 'set', function (key, val, cb) {
                        cb(fake_error);
                    });

                    cache.wrap(key, function (cb) {
                        methods.get_widget(name, cb);
                    }, function (err) {
                        assert.equal(err, fake_error);
                        memory_store_stub.set.restore();
                        done();
                    });
                });
            });

            context("when wrapped function calls back with an error", function () {
                it("calls back with that error", function (done) {
                    var fake_error = new Error(support.random.string());
                    sinon.stub(methods, 'get_widget', function (name, cb) {
                        cb(fake_error, {name: name});
                    });

                    cache.wrap(key, function (cb) {
                        methods.get_widget(name, cb);
                    }, function (err, widget) {
                        methods.get_widget.restore();
                        assert.equal(err, fake_error);
                        assert.ok(!widget);
                        done();
                    });
                });
            });

        });
    });

    describe("instantiating with no store passed in", function () {
        it("defaults to 'memory' store", function () {
            var cache = caching();
            assert.equal(cache.store.name, 'memory');
        });
    });

    describe("instantiating with custom store", function () {
        it("allows us to pass in our own store object", function (done) {
            var store = memory_store.create({ttl: ttl});
            cache = caching({store: store});
            cache.set(key, value, function (err) {
                check_err(err);
                cache.get(key, function (err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });

        it("allows us to pass in a path to our own store", function (done) {
            var store_path = '../lib/stores/memory';
            cache = caching({store: store_path});
            cache.set(key, value, function (err) {
                check_err(err);
                cache.get(key, function (err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });

        it("allows us to pass in a module (uninstantiated)", function (done) {
            var store = memory_store;
            cache = caching({store: store});
            cache.set(key, value, function (err) {
                check_err(err);
                cache.get(key, function (err, result) {
                    assert.equal(result, value);
                    done();
                });
            });
        });
    });
});
