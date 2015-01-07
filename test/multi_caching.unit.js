var assert = require('assert');
var async = require('async');
var sinon = require('sinon');
var support = require('./support');
var check_err = support.check_err;
var caching = require('../index').caching;
var multi_caching = require('../index').multi_caching;
var memory_store = require('../lib/stores/memory');

var methods = {
    get_widget: function(name, cb) {
        cb(null, {name: name});
    }
};

describe("multi_caching", function() {
    var memory_cache;
    var memory_cache2;
    var memory_cache3;
    var multi_cache;
    var key;
    var memory_ttl;
    var name;
    var ttl = 5;

    beforeEach(function() {
        memory_ttl = 0.1;

        memory_cache = caching({store: 'memory', ttl: memory_ttl});
        memory_cache2 = caching({store: 'memory', ttl: memory_ttl});
        memory_cache3 = caching({store: 'memory', ttl: memory_ttl});

        key = support.random.string(20);
        name = support.random.string();
    });

    describe("get(), set(), del()", function() {
        var value;

        beforeEach(function() {
            multi_cache = multi_caching([memory_cache, memory_cache2, memory_cache3]);
            key = support.random.string(20);
            value = support.random.string();
        });

        describe("set()", function() {
            it("lets us set data in all caches", function(done) {
                multi_cache.set(key, value, ttl, function(err) {
                    check_err(err);
                    memory_cache.get(key, function(err, result) {
                        assert.equal(result, value);

                        memory_cache2.get(key, function(err, result) {
                            check_err(err);
                            assert.equal(result, value);

                            memory_cache3.get(key, function(err, result) {
                                check_err(err);
                                assert.equal(result, value);
                                done();
                            });
                        });
                    });
                });
            });

            it("lets us set data without a callback", function(done) {
                multi_cache.set(key, value, ttl);
                setTimeout(function() {
                    multi_cache.get(key, function(err, result) {
                        assert.equal(result, value);
                        memory_cache.get(key, function(err, result) {
                            assert.equal(result, value);

                            memory_cache2.get(key, function(err, result) {
                                check_err(err);
                                assert.equal(result, value);

                                memory_cache3.get(key, function(err, result) {
                                    check_err(err);
                                    assert.equal(result, value);
                                    done();
                                });
                            });
                        });
                    });
                }, 20);
            });

            it("lets us set data without a ttl or callback", function(done) {
                multi_cache.set(key, value);
                setTimeout(function() {
                    multi_cache.get(key, function(err, result) {
                        assert.equal(result, value);
                        memory_cache.get(key, function(err, result) {
                            assert.equal(result, value);

                            memory_cache2.get(key, function(err, result) {
                                check_err(err);
                                assert.equal(result, value);

                                memory_cache3.get(key, function(err, result) {
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

        describe("get()", function() {
            it("gets data from first cache that has it", function(done) {
                memory_cache3.set(key, value, ttl, function(err) {
                    check_err(err);

                    multi_cache.get(key, function(err, result) {
                        check_err(err);
                        assert.equal(result, value);
                        done();
                    });
                });
            });
        });

        describe("del()", function() {
            it("lets us delete data in all caches", function(done) {
                multi_cache.set(key, value, ttl, function(err) {
                    check_err(err);

                    multi_cache.del(key, function(err) {
                        check_err(err);

                        memory_cache.get(key, function(err, result) {
                            assert.ok(!result);

                            memory_cache2.get(key, function(err, result) {
                                check_err(err);
                                assert.ok(!result);

                                memory_cache3.get(key, function(err, result) {
                                    check_err(err);
                                    assert.ok(!result);
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            it("lets us delete data without a callback", function(done) {
                multi_cache.set(key, value, ttl, function(err) {
                    check_err(err);

                    multi_cache.del(key);

                    setTimeout(function() {
                        memory_cache.get(key, function(err, result) {
                            assert.ok(!result);

                            memory_cache2.get(key, function(err, result) {
                                check_err(err);
                                assert.ok(!result);

                                memory_cache3.get(key, function(err, result) {
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

    describe("get_and_pass_up()", function() {
        var value;
        var key;

        describe("using a single cache store", function() {
            beforeEach(function() {
                multi_cache = multi_caching([memory_cache3]);
                key = support.random.string(20);
                value = support.random.string();
            });

            it("gets data from first cache that has it", function(done) {
                memory_cache3.set(key, value, ttl, function(err) {
                    check_err(err);

                    multi_cache.get_and_pass_up(key, function(err, result) {
                        check_err(err);
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
                sinon.spy(memory_cache, 'set');
                sinon.spy(memory_cache2, 'set');
                sinon.spy(memory_cache3, 'set');

                multi_cache.get_and_pass_up(key, function(err, result) {
                    check_err(err);
                    response = result;
                    done();
                });
            });

            afterEach(function() {
                memory_cache.set.restore();
                memory_cache2.set.restore();
                memory_cache3.set.restore();
            });

            it("calls back with undefined", function() {
                assert.strictEqual(response, undefined);
            });

            it("does not set anything in caches", function(done) {
                process.nextTick(function() {
                    assert.ok(memory_cache.set.notCalled);
                    assert.ok(memory_cache2.set.notCalled);
                    assert.ok(memory_cache3.set.notCalled);
                    done();
                });
            });
        });

        describe("using multi cache store", function() {
            beforeEach(function() {
                multi_cache = multi_caching([memory_cache, memory_cache2, memory_cache3]);
                key = support.random.string(20);
                value = support.random.string();
            });

            it("checks to see if higher levels have item", function(done) {
                memory_cache3.set(key, value, ttl, function(err) {
                    check_err(err);

                    multi_cache.get_and_pass_up(key, function(err, result) {
                        check_err(err);
                        assert.equal(result, value);

                        process.nextTick(function() {
                            memory_cache.get(key, function(err, result) {
                                assert.equal(result, value);
                                check_err(err);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe("wrap()", function() {
        describe("using a single cache store", function() {
            beforeEach(function() {
                multi_cache = multi_caching([memory_cache3]);
            });

            context("calls back with the result of a function", function() {
                beforeEach(function() {
                    sinon.spy(memory_cache3.store, 'set');
                });

                afterEach(function() {
                    memory_cache3.store.set.restore();
                });

                it('when a ttl is passed in', function(done) {
                    multi_cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, ttl, function(err, widget) {
                        check_err(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memory_cache3.store.set, key, {name: name}, ttl);
                        done();
                    });
                });

                it('when a ttl is not passed in', function(done) {
                    multi_cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, function(err, widget) {
                        check_err(err);
                        assert.deepEqual(widget, {name: name});
                        sinon.assert.calledWith(memory_cache3.store.set, key, {name: name});
                        done();
                    });
                });
            });

            context("when wrapped function calls back with an error", function() {
                it("calls back with that error", function(done) {
                    var fake_error = new Error(support.random.string());
                    sinon.stub(methods, 'get_widget', function(name, cb) {
                        cb(fake_error, {name: name});
                    });

                    multi_cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, function(err, widget) {
                        methods.get_widget.restore();
                        assert.equal(err, fake_error);
                        assert.ok(!widget);
                        done();
                    });
                });
            });
        });

        describe("using two cache stores", function() {
            beforeEach(function() {
                multi_cache = multi_caching([memory_cache, memory_cache3]);
            });

            it("calls back with the result of a function", function(done) {
                multi_cache.wrap(key, function(cb) {
                    methods.get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("sets value in all caches", function(done) {
                multi_cache.wrap(key, function(cb) {
                    methods.get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});

                    memory_cache.get(key, function(err, result) {
                        check_err(err);
                        assert.deepEqual(result, {name: name});

                        memory_cache3.get(key, function(err, result) {
                            check_err(err);
                            assert.deepEqual(result, {name: name});
                            done();
                        });
                    });
                });
            });

            context("when value exists in first store but not second", function() {
                it("returns value from first store, does not set it in second", function(done) {
                    memory_cache.set(key, {name: name}, ttl, function(err) {
                        check_err(err);

                        multi_cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, function(err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache3.get(key, function(err, result) {
                                check_err(err);
                                assert.equal(result, null);
                                done();
                            });
                        });
                    });
                });
            });

            context("when value exists in second store but not first", function() {
                it("returns value from second store, sets it in first store", function(done) {
                    memory_cache3.set(key, {name: name}, ttl, function(err) {
                        check_err(err);

                        multi_cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, function(err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache.get(key, function(err, result) {
                                check_err(err);
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
                multi_cache = multi_caching([memory_cache, memory_cache3, memory_cache2]);
            });

            it("calls back with the result of a function", function(done) {
                multi_cache.wrap(key, function(cb) {
                    methods.get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("sets value in all caches", function(done) {
                multi_cache.wrap(key, function(cb) {
                    methods.get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});

                    memory_cache.get(key, function(err, result) {
                        check_err(err);
                        assert.deepEqual(result, {name: name});

                        memory_cache2.get(key, function(err, result) {
                            check_err(err);
                            assert.deepEqual(result, {name: name});

                            memory_cache3.get(key, function(err, result) {
                                check_err(err);
                                assert.deepEqual(result, {name: name});
                                done();
                            });
                        });
                    });
                });
            });

            context("when value exists in first store only", function() {
                it("returns value from first store, does not set it in second or third", function(done) {
                    memory_cache.set(key, {name: name}, ttl, function(err) {
                        check_err(err);

                        multi_cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, function(err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache2.get(key, function(err, result) {
                                check_err(err);
                                assert.equal(result, null);

                                memory_cache3.get(key, function(err, result) {
                                    check_err(err);
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
                    memory_cache3.set(key, {name: name}, ttl, function(err) {
                        check_err(err);

                        multi_cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, function(err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache.get(key, function(err, result) {
                                check_err(err);
                                assert.deepEqual(result, {name: name});

                                memory_cache2.get(key, function(err, result) {
                                    check_err(err);
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
                    memory_cache2.set(key, {name: name}, ttl, function(err) {
                        check_err(err);

                        multi_cache.wrap(key, function(cb) {
                            methods.get_widget(name, cb);
                        }, function(err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});

                            memory_cache3.get(key, function(err, result) {
                                check_err(err);
                                assert.deepEqual(result, {name: name});

                                memory_cache.get(key, function(err, result) {
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

        context("error handling", function() {
            var memory_store_stub;
            var ttl;

            beforeEach(function() {
                ttl = 0.1;
                memory_store_stub = memory_store.create({ttl: ttl});
                sinon.stub(memory_store, 'create').returns(memory_store_stub);
                memory_cache = caching({store: 'memory', ttl: ttl});
                multi_cache = multi_caching([memory_cache]);
            });

            afterEach(function() {
                memory_store.create.restore();
            });

            context("when an error is thrown in the work function", function() {
                var fake_error;

                beforeEach(function() {
                    fake_error = new Error(support.random.string());
                });

                it("bubbles up that error", function(done) {
                    multi_cache.wrap(key, function() {
                        throw fake_error;
                    }, ttl, function(err) {
                        assert.equal(err, fake_error);
                        done();
                    });
                });
            });

            context("when store.get() calls back with an error", function() {
                it("bubbles up that error", function(done) {
                    var fake_error = new Error(support.random.string());

                    sinon.stub(memory_store_stub, 'get', function(key, cb) {
                        cb(fake_error);
                    });

                    multi_cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, function(err) {
                        assert.equal(err, fake_error);
                        memory_store_stub.get.restore();
                        done();
                    });
                });
            });

            context("when store.set() calls back with an error", function() {
                it("bubbles up that error", function(done) {
                    var fake_error = new Error(support.random.string());

                    sinon.stub(memory_store_stub, 'set', function(key, val, ttl, cb) {
                        cb(fake_error);
                    });

                    multi_cache.wrap(key, function(cb) {
                        methods.get_widget(name, cb);
                    }, function(err) {
                        assert.equal(err, fake_error);
                        memory_store_stub.set.restore();
                        done();
                    });
                });
            });
        });

        describe("when called multiple times in parallel with same key", function() {
            var construct;

            beforeEach(function() {
                multi_cache = multi_caching([memory_cache, memory_cache3]);

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

                async.each(values, function(val, async_cb) {
                    multi_cache.wrap('key', function(cb) {
                        construct(val, cb);
                    }, function(err, result) {
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

    context("when instantiated with a non-Array 'caches' arg", function() {
        it("throws an error", function() {
            assert.throws(function() {
                multi_caching({foo: 'bar'});
            }, /multi_caching requires an array/);
        });
    });
});
