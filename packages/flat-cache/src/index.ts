import {CacheableMemory} from 'cacheable';

export class FlatCache {
	private readonly _cache = new CacheableMemory();
	constructor() {
		this._cache = new CacheableMemory();
	}

	public get cache() {
		return this._cache;
	}

	/**
	 * Load a cache identified by the given Id. If the element does not exists, then initialize an empty
	 * cache storage. If specified `cacheDir` will be used as the directory to persist the data to. If omitted
	 * then the cache module directory `./cache` will be used instead
	 *
	 * @method load
	 * @param docId {String} the id of the cache, would also be used as the name of the file cache
	 * @param [cacheDir] {String} directory for the cache entry
	 */
	// eslint-disable-next-line unicorn/prevent-abbreviations, @typescript-eslint/no-empty-function
	public load(documentId: string, cacheDir?: string) {}

	/**
	 * Load the cache from the provided file
	 * @method loadFile
	 * @param  {String} pathToFile the path to the file containing the info for the cache
	 */
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public loadFile(pathToFile: string) {}

	/**
	 * Returns the entire persisted object
	 * @method all
	 * @returns {*}
	 */
	public all() {
		return this._cache.keys;
	}

	public keys() {
		return this._cache.keys;
	}

	/**
	 * Sets a key to a given value
	 * @method setKey
	 * @param key {string} the key to set
	 * @param value {object} the value of the key. Could be any object that can be serialized with JSON.stringify
	 */
	public setKey(key: string, value: any) {
		this._cache.set(key, value);
	}

	/**
	 * Remove a given key from the cache
	 * @method removeKey
	 * @param key {String} the key to remove from the object
	 */
	public removeKey(key: string) {
		this._cache.delete(key);
	}

	/**
	* Return the value of the provided key
	* @method getKey<T>
	* @param key {String} the name of the key to retrieve
	* @returns {*} at T the value from the key
	*/
	public getKey<T>(key: string) {
		return this._cache.get(key) as T;
	}

	/**
	 * Save the state of the cache identified by the docId to disk
	 * as a JSON structure
	 * @param [noPrune=false] {Boolean} whether to remove from cache the non visited cache entries
	 * @method save
	 */
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public save(noPrune = false) {}

	/**
	 * Remove the file where the cache is persisted
	 * @method removeCacheFile
	 * @return {Boolean} true or false if the file was successfully deleted
	 */
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public removeCacheFile() {}

	/**
	 * Destroy the file cache and cache content.
	 * @method destroy
	 */
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	public destroy() {}
}

