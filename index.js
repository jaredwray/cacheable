var cache = {
    caching: require('./lib/caching'),
    multi_caching: require('./lib/multi_caching'), //backward compat
    multiCaching: require('./lib/multi_caching')
};

module.exports = cache;
