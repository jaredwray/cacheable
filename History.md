- 0.7.1 2014-06-15
  Adding link to Express.js cache-manager example app

- 0.7.0 2014-06-15
  Bumping package versions, mostly devDependencies

- 0.6.0 2014-06-15
  Adding caching.keys() function (issue #6)
  Updating examples/redis_example/example.js with cache.keys() usage
  Allow calling memory store get() without callback

- 0.5.0 2014-05-02
  Adding reset() function to caching.js.  Closes #5.

- 0.4.0 2014-05-02
  New arg to ignore cache errors. if set cache errors will be ignored
  and the cache_manager will go to the backing store. (Thanks londonjamo).

- 0.3.0 2013-12-08
  Bound the get, set and del functions to their original “this” context when assigning a store.
  (Thanks to Boyan Rabchev)

- 0.2.0 2013-10-31
  Better examples, version bump.

- 0.1.3 2013-10-31
  Fixing unreleased connection in redis example.

- 0.1.2 2013-10-13
  Wrapping synchronous memory cache callbacks in process.nextTick() for the purists.

- 0.1.1 2013-10-13
  Travis and Coveralls integration testing.

- 0.1.0 2013-10-13
  Removing built-in Redis store to emphasize that you should plug in your own
  cache store.

- 0.0.5 2013-10-13
  Removing hiredis requirement.

- 0.0.4 2013-08-01
  Better error checking in multi_cache.wrap();

- 0.0.3 2013-07-10
  Better error checking in cache.wrap();

- 0.0.2 2013-04-08
  Added ability to pass in a store module that isn't already instantiated.
  E.g.,
  ```javascript
  var store = require('/path/to/my_memory_store');
  cache = caching({store: store});
  ```
- 0.0.1 2013-04-08
  Initial release.
