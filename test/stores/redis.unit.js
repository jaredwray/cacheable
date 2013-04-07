var support = require('../support');
var redis_store = require('../../lib/stores/redis');

describe("redis store", function () {
    describe("instantiating", function () {
        it("lets us pass in a db arg", function (done) {
            // Not sure how to prove that it uses the specified db in this test,
            // but it does.
            var redis_cache = redis_store.create({db: 2});
            support.test_set_get_del(redis_cache, done);
        });

        it("lets us pass in no args", function (done) {
            var redis_cache = redis_store.create();
            support.test_set_get_del(redis_cache, done);
        });
    });
});
