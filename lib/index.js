/** @namespace cacheManager */
var cacheManager = {
    caching: require('./caching'),
    // Deprecate
    //jscs:disable requireCamelCaseOrUpperCaseIdentifiers
    multi_caching: require('./multi_caching'), //backward compat
    //jscs:enable requireCamelCaseOrUpperCaseIdentifiers
    multiCaching: require('./multi_caching')
};

module.exports = cacheManager;
