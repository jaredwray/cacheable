- 0.16.0 2015-01-07
  Get and pass up feature to update higher caches. (#19) - raadad
  Minor style tweaks/jscs update.

- 0.15.0 2014-12-18
  Moved cache queue before the store get function (up to 2x performance boost). (#18) - aletorrado
  Added domain support to make sure the wrap callback function is always called - aletorrado

- 0.14.0 2014-10-15
  Set ttl in wrap #14 - nguyenchr
  Added JSCS for style checking

- 0.13.0 2014-10-14
  Applied work function locking for multi_caching (#13). -aletorrado

- 0.12.0 2014-10-09
  Checking for existence of del() method before binding to it. Fixes #11.

- 0.11.0 2014-09-18
  Prevent stalemate by executing callbacks on error. Fixes #10 - elliotttf

- 0.10.1 2014-09-10
  Fixed tag/version mismatch

- 0.10.0 2014-09-10
  Fixing Use call instead of apply for cached results, issue #9 (thanks elliotttf)

- 0.9.0 2014-08-19
  Fixing issue #8 - parallel requests to a wrapped function were calling the
  function multiple times. (Thanks alex-whitney).

- 0.8.0 2014-07-07
  Adding setex() (Thanks evanlucas)

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
