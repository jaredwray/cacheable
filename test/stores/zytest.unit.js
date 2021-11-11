var assert = require('assert');
var support = require('../support');
var checkErr = support.checkErr;
var memoryStore = require('../../lib/stores/memory');

// var Promise = require('es6-promise').Promise;

describe("zy-test-caching", function() {

    describe("dump()", function() {
        var memoryCache;
        // var origPromise;
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
        // var origPromise;
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
