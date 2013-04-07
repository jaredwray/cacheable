/*
var redis_store = function(args) {
    args = args || {};
    var db = args.db || 'cache';
    var self = {};
    var ttl = args.ttl;
    var client = djs.backends.redis.client({db: djs.settings.redis.dbs[db]});

    self.set = function(key, value, cb) {
        var val = JSON.stringify(value);
        if (ttl) {
            client.command('setex', {key: key, ttl: ttl, value: val}, cb);
        } else {
            client.command('set', {key: key, value: val}, cb);
        }
    };

    self.get = function(key, cb) {
        client.command('get', {key: key}, function(err, result) {
            if (err) { return cb(err); }
            if (result === undefined) { return cb(null, null); }
            return cb(null, JSON.parse(result));
        });
    };

    self.del = function(key, cb) {
        client.command('del', {key: key}, cb);
    };

    return self;
};
*/

function redis_store(args) {
    args = args || {};
    var self = {};
    var ttl = args.ttl;
    self.client = require('redis').createClient(args.port, args.host, args);

    self.get = function(key, cb) {
        self.client.get(key, function(err, result) {
            cb(err, JSON.parse(result));
        });
    };

    self.set = function(key, value, cb) {
        if (ttl) {
            self.client.setex(key, ttl, JSON.stringify(value), cb);
        } else {
            self.client.set(key, JSON.stringify(value), cb);
        }
    };

    self.del = function(key, cb) {
        self.client.del(key, cb);
    };

    return self;
}


var methods = {
    create: function(args) {
        return redis_store(args);
    }
};

module.exports = methods;
