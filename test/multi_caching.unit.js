var assert = require('assert');
var sinon = require('sinon');
var support = require('./support');
var check_err = support.check_err;
var caching = require('../index').caching;
var multi_caching = require('../index').multi_caching;
var memory_store = require('../lib/stores/memory');

var methods = {
    get_widget: function (name, cb) {
        cb(null, {name: name});
    }
};

describe("multi_caching", function () {
    var memory_cache;
    var memory_cache2;
    var memory_cache3;
    var multi_cache;
    var key;
    var memory_ttl;
    var name;

    beforeEach(function () {
        memory_ttl = 0.1;

        memory_cache = caching({store: 'memory', ttl: memory_ttl});
        memory_cache2 = caching({store: 'memory', ttl: memory_ttl});
        memory_cache3 = caching({store: 'memory', ttl: memory_ttl});

        key = support.random.string(20);
        name = support.random.string();
    });

    describe("get(), set(), del()", function () {
        var value;

        beforeEach(function () {
            multi_cache = multi_caching([memory_cache, memory_cache2, memory_cache3]);
            key = support.random.string(20);
            value = support.random.string();
        });

        describe("set()", function () {
            it("lets us set data in all caches", function (done) {
                multi_cache.set(key, value, function (err) {
                    check_err(err);
                    memory_cache.get(key, function (err, result) {
                        assert.equal(result, value);

                        memory_cache2.get(key, function (err, result) {
                            check_err(err);
                            assert.equal(result, value);

                            memory_cache3.get(key, function (err, result) {
                                check_err(err);
                                assert.equal(result, value);
                                done();
                            });
                        });
                    });
                });
            });

            it("lets us set data without a callback", function (done) {
                multi_cache.set(key, value);
                setTimeout(function () {
                    multi_cache.get(key, function (err, result) {
                        assert.equal(result, value);
                        memory_cache.get(key, function (err, result) {
                            assert.equal(result, value);

                            memory_cache2.get(key, function (err, result) {
                                check_err(err);
                                assert.equal(result, value);

                                memory_cache3.get(key, function (err, result) {
                                    check_err(err);
                                    assert.equal(result, value);
                                    done();
                                });
                            });
                        });
                    });
                }, 20);
            });
        });

        describe("get()", function () {
            it("gets data from first cache that has it", function (done) {
                memory_cache3.set(key, value, function (err) {
                    check_err(err);

                    multi_cache.get(key, function (err, result) {
                        check_err(err);
                        assert.equal(result, value);
                        done();
                    });
                });
            });
        });

        describe("del()", function () {
            it("lets us delete data in all caches", function (done) {
                multi_cache.set(key, value, function (err) {
                    check_err(err);

                    multi_cache.del(key, function (err) {
                        check_err(err);

                        memory_cache.get(key, function (err, result) {
                            assert.ok(!result);

                            memory_cache2.get(key, function (err, result) {
                                check_err(err);
                                assert.ok(!result);

                                memory_cache3.get(key, function (err, result) {
                                    check_err(err);
                                    assert.ok(!result);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            it("lets us delete data without a callback", function (done) {
                multi_cache.set(key, value, function (err) {
                    check_err(err);

                    multi_cache.del(key);

                    setTimeout(function () {
                        memory_cache.get(key, function (err, result) {
                            assert.ok(!result);

                            memory_cache2.get(key, function (err, result) {
                                check_err(err);
                                assert.ok(!result);

                                memory_cache3.get(key, function (err, result) {
                                    check_err(err);
                                    assert.ok(!result);
                                    done();
                                });
                            });
                        });
                    });
                }, 10);
            });
        });
    });

    describe("wrap()", function () {
        describe("using a single cache store", function () {
            beforeEach(function () {
                multi_cache = multi_caching([memory_cache3]);
            });

            it("calls back with the result of a function", function (done) {
                multi_cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            context("when wrapped function calls back with an error", function () {
                it("calls back with that error", function (done) {
                    var fake_error = new Error(support.random.string());
                    sinon.stub(methods, 'get_widget', function (name, cb) {
                        cb(fake_error, {name: name});
                    });

                    multi_cache.wrap(key, function (cb) {
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

        describe("using two cache stores", function () {
            beforeEach(function () {
                multi_cache = multi_caching([memory_cache, memory_cache3]);
            });

            it("calls back with the result of a function", function (done) {
                multi_cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("sets value in all caches", function (done) {
                multi_cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});

                    memory_cache.get(key, function (err, result) {
                        check_err(err);
                        assert.deepEqual(result, {name: name});

                        memory_cache3.get(key, function (err, result) {
                            check_err(err);
                            assert.deepEqual(result, {name: name});
                            done();
                        });
                    });
                });
            });

            context("when value exists in first store but not second", function () {
                it("returns value from first store, does not set it in second", function (done) {
                    memory_cache.set(key, {name: name}, function (err) {
                        check_err(err);

                        multi_cache.wrap(key, function (cb) {
                            methods.get_widget(name, cb);
                        }, function (err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache3.get(key, function (err, result) {
                                check_err(err);
                                assert.equal(result, null);
                                done();
                            });
                        });
                    });
                });
            });

            context("when value exists in second store but not first", function () {
                it("returns value from second store, sets it in first store", function (done) {
                    memory_cache3.set(key, {name: name}, function (err) {
                        check_err(err);

                        multi_cache.wrap(key, function (cb) {
                            methods.get_widget(name, cb);
                        }, function (err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache.get(key, function (err, result) {
                                check_err(err);
                                assert.deepEqual(result, {name: name});
                                done();
                            });
                        });
                    });
                });
            });
        });

        describe("using three cache stores", function () {
            beforeEach(function () {
                multi_cache = multi_caching([memory_cache, memory_cache3, memory_cache2]);
            });

            it("calls back with the result of a function", function (done) {
                multi_cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("sets value in all caches", function (done) {
                multi_cache.wrap(key, function (cb) {
                    methods.get_widget(name, cb);
                }, function (err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});

                    memory_cache.get(key, function (err, result) {
                        check_err(err);
                        assert.deepEqual(result, {name: name});

                        memory_cache2.get(key, function (err, result) {
                            check_err(err);
                            assert.deepEqual(result, {name: name});

                            memory_cache3.get(key, function (err, result) {
                                check_err(err);
                                assert.deepEqual(result, {name: name});
                                done();
                            });
                        });
                    });
                });
            });

            context("when value exists in first store only", function () {
                it("returns value from first store, does not set it in second or third", function (done) {
                    memory_cache.set(key, {name: name}, function (err) {
                        check_err(err);

                        multi_cache.wrap(key, function (cb) {
                            methods.get_widget(name, cb);
                        }, function (err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache2.get(key, function (err, result) {
                                check_err(err);
                                assert.equal(result, null);

                                memory_cache3.get(key, function (err, result) {
                                    check_err(err);
                                    assert.equal(result, null);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            context("when value exists in second store only", function () {
                it("returns value from second store, sets it in first store, does not set third store", function (done) {
                    memory_cache3.set(key, {name: name}, function (err) {
                        check_err(err);

                        multi_cache.wrap(key, function (cb) {
                            methods.get_widget(name, cb);
                        }, function (err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache.get(key, function (err, result) {
                                check_err(err);
                                assert.deepEqual(result, {name: name});

                                memory_cache2.get(key, function (err, result) {
                                    check_err(err);
                                    assert.equal(result, null);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            context("when value exists in third store only", function () {
                it("returns value from third store, sets it in first and second stores", function (done) {
                    memory_cache2.set(key, {name: name}, function (err) {
                        check_err(err);

                        multi_cache.wrap(key, function (cb) {
                            methods.get_widget(name, cb);
                        }, function (err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache3.get(key, function (err, result) {
                                check_err(err);
                                assert.deepEqual(result, {name: name});

                                memory_cache.get(key, function (err, result) {
                                    check_err(err);
                                    assert.deepEqual(result, {name: name});

                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });

        context("error handling", function () {
            var memory_store_stub;
            var ttl;

            beforeEach(function () {
                ttl = 0.1;
                memory_store_stub = memory_store.create({ttl: ttl});
                sinon.stub(memory_store, 'create').returns(memory_store_stub);
                memory_cache = caching({store: 'memory', ttl: ttl});
                multi_cache = multi_caching([memory_cache]);
            });

            afterEach(function () {
                memory_store.create.restore();
            });

            context("when store.get() calls back with an error", function () {
                it("bubbles up that error", function (done) {
                    var fake_error = new Error(support.random.string());

                    sinon.stub(memory_store_stub, 'get', function (key, cb) {
                        cb(fake_error);
                    });

                    multi_cache.wrap(key, function (cb) {
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

                    multi_cache.wrap(key, function (cb) {
                        methods.get_widget(name, cb);
                    }, function (err) {
                        assert.equal(err, fake_error);
                        memory_store_stub.set.restore();
                        done();
                    });
                });
            });
        });
    });

    context("when instantiated with a non-Array 'caches' arg", function () {
        it("throws an error", function () {
            assert.throws(function () {
                multi_caching({foo: 'bar'});
            }, /multi_caching requires an array/);
        });
    });
});
