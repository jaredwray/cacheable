- 0.0.3 2013-07-10
  Better error checking in cache.wrap();

- 0.0.2 2013-04-08
  Added ability to pass in a store module that isn't already instantiated.
  E.g.,
  ```javascript
  var store = require('/path/my_memory_store');
  cache = caching({store: store});
  ```
- 0.0.1 2013-04-08
  Initial release.

