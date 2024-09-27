import {CacheableMemory} from 'cacheable';

export type FlatCacheOptions = {
	ttl?: number;
	useClone?: boolean;
	lruSize?: number;
	expirationInterval?: number;
	persistInterval?: number;
	cacheDir?: string;
};

export class FlatCache {
	private readonly _cache = new CacheableMemory();
	private _cacheDir = '.cache';
	private _persistInterval = 0;
	constructor(options?: FlatCacheOptions) {
		if (options) {
			this._cache = new CacheableMemory({
				ttl: options.ttl,
				useClone: options.useClone,
				lruSize: options.lruSize,
				checkInterval: options.expirationInterval,
			});
		}

		if (options?.cacheDir) {
			this._cacheDir = options.cacheDir;
		}

		if (options?.persistInterval) {
			this._persistInterval = options.persistInterval;
		}
	}

	/**
	 * The cache object
	 * @property cache
	 * @type {CacheableMemory}
	 */
	public get cache() {
		return this._cache;
	}

	/**
	 * The cache directory
	 * @property cacheDir
	 * @type {String}
	 * @default '.cache'
	 */
	public get cacheDir() {
		return this._cacheDir;
	}

	/**
	 * Set the cache directory
	 * @property cacheDir
	 * @type {String}
	 * @default '.cache'
	 */
	public set cacheDir(value: string) {
		this._cacheDir = value;
	}

	/**
	 * The interval to persist the cache to disk. 0 means no timed persistence
	 * @property persistInterval
	 * @type {Number}
	 * @default 0
	 */
	public get persistInterval() {
		return this._persistInterval;
	}

	/**
	 * Set the interval to persist the cache to disk. 0 means no timed persistence
	 * @property persistInterval
	 * @type {Number}
	 * @default 0
	 */
	public set persistInterval(value: number) {
		this._persistInterval = value;
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
		const result: Record<string, any> = {};
		const items = Array.from(this._cache.items);
		for (const item of items) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			result[item.key] = item.value;
		}

		return result;
	}

	/**
	 * Returns an array with all the items in the cache { key, value, ttl }
	 * @method items
	 * @returns {Array}
	 */
	public get items() {
		return Array.from(this._cache.items);
	}

	/**
	 * Returns an array with all the keys in the cache
	 * @method keys
	 * @returns {Array}
	 */
	public keys() {
		return Array.from(this._cache.keys);
	}

	/**
	 * (Legacy) set key method. This method will be deprecated in the future
	 * @method setKey
	 * @param key {string} the key to set
	 * @param value {object} the value of the key. Could be any object that can be serialized with JSON.stringify
	 */
	public setKey(key: string, value: any) {
		this._cache.set(key, value);
	}

	/**
	 * Sets a key to a given value
	 * @method set
	 * @param key {string} the key to set
	 * @param value {object} the value of the key. Could be any object that can be serialized with JSON.stringify
	 * @param [ttl] {number} the time to live in milliseconds
	 */
	public set(key: string, value: any, ttl?: number) {
		this._cache.set(key, value, ttl);
	}

	/**
	 * (Legacy) Remove a given key from the cache. This method will be deprecated in the future
	 * @method removeKey
	 * @param key {String} the key to remove from the object
	 */
	public removeKey(key: string) {
		this._cache.delete(key);
	}

	/**
	 * Remove a given key from the cache
	 * @method delete
	 * @param key {String} the key to remove from the object
	 */
	public delete(key: string) {
		this._cache.delete(key);
	}

	/**
	* (Legacy) Return the value of the provided key. This method will be deprecated in the future
	* @method getKey<T>
	* @param key {String} the name of the key to retrieve
	* @returns {*} at T the value from the key
	*/
	public getKey<T>(key: string) {
		return this.get<T>(key);
	}

	/**
	 * Return the value of the provided key
	 * @method get<T>
	 * @param key {String} the name of the key to retrieve
	 * @returns {*} at T the value from the key
	 */
	public get<T>(key: string) {
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

