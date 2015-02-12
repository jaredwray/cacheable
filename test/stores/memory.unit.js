var support = require('../support');
var memoryStore = require('../../lib/stores/memory');

describe("memory store", function() {
    describe("instantiating", function() {
        it("lets us pass in no args", function(done) {
            var memoryCache = memoryStore.create();
            support.testSetGetDel(memoryCache, done);
        });
    });
});
