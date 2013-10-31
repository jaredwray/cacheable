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
