/*eslint no-unused-vars:0*/
var Lru = require("lru-cache");
var cloneDeep = require('lodash.clonedeep');
var utils = require('../utils');
var isObject = utils.isObject;

function clone(object) {
    if (typeof object === 'object' && object !== null) {
        return cloneDeep(object);
    }
    return object;
}

/**
 * Wrapper for lru-cache.
 * NOTE: If you want to use a memory store, you want to write your own to have full
 * control over its behavior.  E.g., you might need the extra Promise overhead or
 * you may want to clone objects a certain way before storing.
 *
 * @param {object} args - Args passed to underlying lru-cache, plus additional optional args:
 * @param {boolean} [args.shouldCloneBeforeSet=true] - Whether to clone the data being stored.
 *   Default: true
 * @param {boolean} [args.usePromises=true] - Whether to enable the use of Promises. Default: true
 */
var memoryStore = function(args) {
    args = args || {};
    var self = {};
    self.name = 'memory';
    var Promise = args.promiseDependency || global.Promise;
    self.usePromises = !(typeof Promise === 'undefined' || args.noPromises);
    self.shouldCloneBeforeSet = args.shouldCloneBeforeSet !== false; // clone by default

    var lruOpts = {
        max: args.max || 500,
        maxSize: args.maxSize,
        ttl: (args.ttl || args.ttl === 0) ? args.ttl * 1000 : undefined,
        dispose: args.dispose,
        sizeCalculation: args.sizeCalculation || args.length,
        allowStale: args.allowStale || args.stale,
        updateAgeOnGet: args.updateAgeOnGet,
        updateAgeOnHas: args.updateAgeOnHas
    };

    var lruCache = new Lru(lruOpts);

    var setMultipleKeys = function setMultipleKeys(keysValues, ttl) {
        var length = keysValues.length;
        var values = [];
        for (var i = 0; i < length; i += 2) {
            lruCache.set(keysValues[i], keysValues[i + 1], {ttl});
            values.push(keysValues[i + 1]);
        }
        return values;
    };

    self.set = function(key, value, options, cb) {
        if (self.shouldCloneBeforeSet) {
            value = clone(value);
        }

        if (typeof options === 'function') {
            cb = options;
            options = {};
        }
        options = options || {};

        if (options && typeof options === 'number') {
            options = {ttl: options};
        }

        var ttl = (options.ttl || options.ttl === 0) ? options.ttl * 1000 : lruOpts.ttl;

        lruCache.set(key, value, {ttl});
        if (cb) {
            process.nextTick(cb.bind(null, null));
        } else if (self.usePromises) {
            return Promise.resolve(value);
        }
    };

    self.mset = function() {
        var args = Array.prototype.slice.apply(arguments);
        var cb;
        var options = {};

        if (typeof args[args.length - 1] === 'function') {
            cb = args.pop();
        }

        if (args.length % 2 > 0 && isObject(args[args.length - 1])) {
            options = args.pop();
        }

        var ttl = (options.ttl || options.ttl === 0) ? options.ttl * 1000 : lruOpts.ttl;

        var values = setMultipleKeys(args, ttl);

        if (cb) {
            process.nextTick(cb.bind(null, null));
        } else if (self.usePromises) {
            return Promise.resolve(values);
        }
    };

    self.get = function(key, options, cb) {
        if (typeof options === 'function') {
            cb = options;
        }
        var value = lruCache.get(key);

        if (cb) {
            process.nextTick(cb.bind(null, null, value));
        } else if (self.usePromises) {
            return Promise.resolve(value);
        } else {
            return value;
        }
    };

    self.mget = function() {
        var args = Array.prototype.slice.apply(arguments);
        var cb;
        var options = {};

        if (typeof args[args.length - 1] === 'function') {
            cb = args.pop();
        }

        if (isObject(args[args.length - 1])) {
            options = args.pop();
        }

        var values = args.map(function(key) {
            return lruCache.get(key);
        });

        if (cb) {
            process.nextTick(cb.bind(null, null, values));
        } else if (self.usePromises) {
            return Promise.resolve(values);
        } else {
            return values;
        }
    };

    self.del = function() {
        var args = Array.prototype.slice.apply(arguments);
        var cb;
        var options = {};

        if (typeof args[args.length - 1] === 'function') {
            cb = args.pop();
        }

        if (isObject(args[args.length - 1])) {
            options = args.pop();
        }

        if (Array.isArray(args[0])) {
            args = args[0];
        }

        args.forEach(function(key) {
            lruCache.delete(key);
        });

        if (cb) {
            process.nextTick(cb.bind(null, null));
        } else if (self.usePromises) {
            return Promise.resolve();
        }
    };

    self.reset = function(cb) {
        lruCache.clear();
        if (cb) {
            process.nextTick(cb.bind(null, null));
        } else if (self.usePromises) {
            return Promise.resolve();
        }
    };

    self.keys = function(cb) {
        var keys = [...lruCache.keys()];
        if (cb) {
            process.nextTick(cb.bind(null, null, keys));
        } else if (self.usePromises) {
            return Promise.resolve(keys);
        } else {
            return keys;
        }
    };

    /**
     * This method is not available in the caching modules.
     */
    self.keyCount = function() {
        return lruCache.size;
    };

    /**
     * This method is not available in the caching modules.
     */
    self.dump = function() {
        var args = Array.prototype.slice.apply(arguments);
        var cb;

        if (typeof args[args.length - 1] === 'function') {
            cb = args.pop();
        }
        var value = lruCache.dump();

        if (cb) {
            process.nextTick(cb.bind(null, null, value));
        } else if (self.usePromises) {
            return Promise.resolve(value);
        } else {
            return value;
        }
    };

    /**
     * This method is not available in the caching modules.
     */
    self.load = function(cacheEntries, cb) {
        lruCache.load(cacheEntries);

        if (typeof cb === 'function') {
            process.nextTick(cb.bind(null, null));
        } else if (self.usePromises) {
            return Promise.resolve();
        }
    };

    return self;
};

var methods = {
    create: function(args) {
        return memoryStore(args);
    }
};

module.exports = methods;
