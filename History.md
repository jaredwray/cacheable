- 0.0.1
  Initial release.

- 0.0.2
  Added ability to pass in a store module that isn't already instantiated.
  E.g.,
  ```javascript
  var store = require('/path/my_memory_store');
  cache = caching({store: store});
  ```
