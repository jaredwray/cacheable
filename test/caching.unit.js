var assert = require('assert');
var sinon = require('sinon');
var redis = require('redis');
var Lru = require("lru-cache")
var support = require('./support');
var check_err = support.check_err;
var caching = require('../index').caching;
var memory_store = require('../lib/stores/memory');

function get_widget(name, cb) {
    cb(null, {name: name});
}

describe("caching", function() {
    var cache;
    var key;
    var ttl;
    var name;
    var value;

    describe("get() and set()", function() {
        context("using redis store", function() {
            beforeEach(function() {
                cache = caching({store: 'redis'});
                key = support.random.string(20);
                value = support.random.string();
            });

            it("lets us set and get data in cache", function(done) {
                cache.set(key, value, function(err, result) {
                    check_err(err);
                    cache.get(key, function(err, result) {
                        assert.equal(result, value);
                        done();
                    });
                });
            });
        });

        context("using memory store", function() {
            beforeEach(function() {
                cache = caching({store: 'memory'});
                key = support.random.string(20);
                value = support.random.string();
            });

            it("lets us set and get data in cache", function(done) {
                cache.set(key, value, function(err, result) {
                    check_err(err);
                    cache.get(key, function(err, result) {
                        assert.equal(result, value);
                        done();
                    });
                });
            });
        });
    });

    describe("del()", function() {
        ['redis', 'memory'].forEach(function(store) {
            context("using " + store + " store", function() {
                beforeEach(function(done) {
                    cache = caching({store: store});
                    key = support.random.string(20);
                    value = support.random.string();
                    cache.set(key, value, function(err, result) {
                        check_err(err);
                        done();
                    });
                });

                it("deletes data from cache", function(done) {
                    cache.get(key, function(err, result) {
                        assert.equal(result, value);

                        cache.del(key, function(err, result) {
                            check_err(err);

                            cache.get(key, function(err, result) {
                                assert.ok(!result);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe("run()", function() {
        context("using redis store", function() {
            var redis_client;

            before(function() {
                redis_client = redis.createClient();
                sinon.stub(redis, 'createClient').returns(redis_client);
            });

            beforeEach(function() {
                cache = caching({store: 'redis'});
                key = support.random.string(20);
                name = support.random.string();
            });

            after(function() {
                redis.createClient.restore();
            });

            it("calls back with the result of the wrapped function", function(done) {
                cache.run(key, function(cb) {
                    get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("caches the result of the function in redis", function(done) {
                cache.run(key, function(cb) {
                    get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);

                    redis_client.get(key, function(err, result) {
                        check_err(err);
                        assert.deepEqual(JSON.parse(result), {name: name});

                        done();
                    });
                });
            });

            it("retrieves data from redis when available", function(done) {
                cache.run(key, function(cb) {
                    get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);

                    redis_client.get(key, function(err, result) {
                        check_err(err);

                        sinon.spy(redis_client, 'get');

                        cache.run(key, function(cb) {
                            get_widget(name, cb);
                        }, function(err, widget) {
                            check_err(err);
                            assert.deepEqual(widget, {name: name});
                            assert.ok(redis_client.get.calledWith(key));
                            redis_client.get.restore();
                            done();
                        });
                    });
                });
            });

            context("when using ttl", function() {
                beforeEach(function() {
                    ttl = 50;
                    cache = caching({store: 'redis', ttl: ttl});
                });

                it("expires cached result after ttl seconds", function(done) {
                    cache.run(key, function(cb) {
                        get_widget(name, cb);
                    }, function(err, widget) {
                        check_err(err);

                        redis_client.ttl(key, function(err, result) {
                            check_err(err);
                            support.assert_within(result, ttl, 2);
                            done();
                        });
                    });
                });
            });
        });


        describe("using memory (lru-cache) store", function() {
            var memory_store_stub;

            beforeEach(function() {
                ttl = 0.1;
                memory_store_stub = memory_store.create({ttl: ttl});

                sinon.stub(memory_store, 'create').returns(memory_store_stub);

                cache = caching({store: 'memory', ttl: ttl});
                key = support.random.string(20);
                name = support.random.string();
            });

            afterEach(function() {
                memory_store.create.restore();
            });

            it("calls back with the result of a function", function(done) {
                cache.run(key, function(cb) {
                    get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);
                    assert.deepEqual(widget, {name: name});
                    done();
                });
            });

            it("retrieves data from memory when available", function(done) {
                cache.run(key, function(cb) {
                    get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);

                    memory_store_stub.get(key, function(err, result) {
                        check_err(err);

                        sinon.spy(memory_store_stub, 'get');
                        var func_called = false;

                        cache.run(key, function(cb) {
                            get_widget(name, function(err, result) {
                                func_called = true;
                                cb(err, result);
                            });
                        }, function(err, widget) {
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

            it("expires cached result after ttl seconds", function(done) {
                cache.run(key, function(cb) {
                    get_widget(name, cb);
                }, function(err, widget) {
                    check_err(err);

                    memory_store_stub.get(key, function(err, result) {
                        check_err(err);
                        assert.deepEqual(widget, {name: name});

                        var func_called = false;

                        setTimeout(function () {
                            cache.run(key, function(cb) {
                                get_widget(name, function(err, result) {
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
        });
    });
});
