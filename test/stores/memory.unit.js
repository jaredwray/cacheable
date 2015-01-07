var support = require('../support');
var memory_store = require('../../lib/stores/memory');

describe("memory store", function() {
    describe("instantiating", function() {
        it("lets us pass in no args", function(done) {
            var memory_cache = memory_store.create();
            support.test_set_get_del(memory_cache, done);
        });
    });
});
