import path from 'node:path';
import fs from 'node:fs';
import {CacheableMemory} from 'cacheable';
import {parse, stringify} from 'flatted';
import {Hookified} from 'hookified';

export type FlatCacheOptions = {
	ttl?: number | string;
	useClone?: boolean;
	lruSize?: number;
	expirationInterval?: number;
	persistInterval?: number;
	cacheDir?: string;
	cacheId?: string;
	deserialize?: (data: string) => any;
	serialize?: (data: any) => string;
};

export enum FlatCacheEvents {
	SAVE = 'save',
	LOAD = 'load',
	DELETE = 'delete',
	CLEAR = 'clear',
	DESTROY = 'destroy',
	ERROR = 'error',
	EXPIRED = 'expired',
}

export class FlatCache extends Hookified {
	private readonly _cache = new CacheableMemory();
	private _cacheDir = '.cache';
	private _cacheId = 'cache1';
	private _persistInterval = 0;
	private _persistTimer: NodeJS.Timeout | undefined;
	private _changesSinceLastSave = false;
	private readonly _parse = parse;
	private readonly _stringify = stringify;
	constructor(options?: FlatCacheOptions) {
		super();
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

		if (options?.cacheId) {
			this._cacheId = options.cacheId;
		}

		if (options?.persistInterval) {
			this._persistInterval = options.persistInterval;
			this.startAutoPersist();
		}

		if (options?.deserialize) {
			this._parse = options.deserialize;
		}

		if (options?.serialize) {
			this._stringify = options.serialize;
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
	 * The cache id
	 * @property cacheId
	 * @type {String}
	 * @default 'cache1'
	 */
	public get cacheId() {
		return this._cacheId;
	}

	/**
	 * Set the cache id
	 * @property cacheId
	 * @type {String}
	 * @default 'cache1'
	 */
	public set cacheId(value: string) {
		this._cacheId = value;
	}

	/**
	 * The flag to indicate if there are changes since the last save
	 * @property changesSinceLastSave
	 * @type {Boolean}
	 * @default false
	 */
	public get changesSinceLastSave() {
		return this._changesSinceLastSave;
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
	 * then the cache module directory `.cacheDir` will be used instead
	 *
	 * @method load
	 * @param cacheId {String} the id of the cache, would also be used as the name of the file cache
	 * @param cacheDir {String} directory for the cache entry
	 */

	public load(cacheId?: string, cacheDir?: string) {
		try {
			const filePath = path.resolve(`${cacheDir ?? this._cacheDir}/${cacheId ?? this._cacheId}`);
			this.loadFile(filePath);
			this.emit(FlatCacheEvents.LOAD);
		/* c8 ignore next 4 */
		} catch (error) {
			this.emit(FlatCacheEvents.ERROR, error);
		}
	}

	/**
	 * Load the cache from the provided file
	 * @method loadFile
	 * @param  {String} pathToFile the path to the file containing the info for the cache
	 */

	public loadFile(pathToFile: string) {
		if (fs.existsSync(pathToFile)) {
			const data = fs.readFileSync(pathToFile, 'utf8');
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const items = this._parse(data);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			for (const key of Object.keys(items)) {
				this._cache.set(items[key].key as string, items[key].value, {expire: items[key].expires as number});
			}

			this._changesSinceLastSave = true;
		}
	}

	public loadFileStream(pathToFile: string, onProgress: (progress: number, total: number) => void, onEnd: () => void, onError?: (error: Error) => void) {
		if (fs.existsSync(pathToFile)) {
			const stats = fs.statSync(pathToFile);
			const total = stats.size;
			let loaded = 0;
			let streamData = '';
			const readStream = fs.createReadStream(pathToFile, {encoding: 'utf8'});
			readStream.on('data', chunk => {
				loaded += chunk.length;
				streamData += chunk as string;
				onProgress(loaded, total);
			});

			readStream.on('end', () => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const items = this._parse(streamData);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				for (const key of Object.keys(items)) {
					this._cache.set(items[key].key as string, items[key].value, {expire: items[key].expires as number});
				}

				this._changesSinceLastSave = true;
				onEnd();
			});
			/* c8 ignore next 5 */
			readStream.on('error', error => {
				this.emit(FlatCacheEvents.ERROR, error);
				if (onError) {
					onError(error);
				}
			});
		} else {
			const error = new Error(`Cache file ${pathToFile} does not exist`);
			this.emit(FlatCacheEvents.ERROR, error);
			if (onError) {
				onError(error);
			}
		}
	}

	/**
	 * Returns the entire persisted object
	 * @method all
	 * @returns {*}
	 */
	public all() {
		const result: Record<string, any> = {};
		const items = [...this._cache.items];
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
		return [...this._cache.items];
	}

	/**
	 * Returns the path to the file where the cache is persisted
	 * @method cacheFilePath
	 * @returns {String}
	 */
	public get cacheFilePath() {
		return path.resolve(`${this._cacheDir}/${this._cacheId}`);
	}

	/**
	 * Returns the path to the cache directory
	 * @method cacheDirPath
	 * @returns {String}
	 */
	public get cacheDirPath() {
		return path.resolve(this._cacheDir);
	}

	/**
	 * Returns an array with all the keys in the cache
	 * @method keys
	 * @returns {Array}
	 */
	public keys() {
		return [...this._cache.keys];
	}

	/**
	 * (Legacy) set key method. This method will be deprecated in the future
	 * @method setKey
	 * @param key {string} the key to set
	 * @param value {object} the value of the key. Could be any object that can be serialized with JSON.stringify
	 */
	public setKey(key: string, value: any, ttl?: number | string) {
		this.set(key, value, ttl);
	}

	/**
	 * Sets a key to a given value
	 * @method set
	 * @param key {string} the key to set
	 * @param value {object} the value of the key. Could be any object that can be serialized with JSON.stringify
	 * @param [ttl] {number} the time to live in milliseconds
	 */
	public set(key: string, value: any, ttl?: number | string) {
		this._cache.set(key, value, ttl);
		this._changesSinceLastSave = true;
	}

	/**
	 * (Legacy) Remove a given key from the cache. This method will be deprecated in the future
	 * @method removeKey
	 * @param key {String} the key to remove from the object
	 */
	public removeKey(key: string) {
		this.delete(key);
	}

	/**
	 * Remove a given key from the cache
	 * @method delete
	 * @param key {String} the key to remove from the object
	 */
	public delete(key: string) {
		this._cache.delete(key);
		this._changesSinceLastSave = true;
		this.emit(FlatCacheEvents.DELETE, key);
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
	 * Clear the cache and save the state to disk
	 * @method clear
	 */
	public clear() {
		try {
			this._cache.clear();
			this._changesSinceLastSave = true;
			this.save();
			this.emit(FlatCacheEvents.CLEAR);
		/* c8 ignore next 4 */
		} catch (error) {
			this.emit(FlatCacheEvents.ERROR, error);
		}
	}

	/**
	 * Save the state of the cache identified by the docId to disk
	 * as a JSON structure
	 * @method save
	 */
	public save(force = false) {
		try {
			if (this._changesSinceLastSave || force) {
				const filePath = this.cacheFilePath;
				const items = [...this._cache.items];
				const data = this._stringify(items);

				// Ensure the directory exists
				if (!fs.existsSync(this._cacheDir)) {
					fs.mkdirSync(this._cacheDir, {recursive: true});
				}

				fs.writeFileSync(filePath, data);
				this._changesSinceLastSave = false;
				this.emit(FlatCacheEvents.SAVE);
			}
		/* c8 ignore next 4 */
		} catch (error) {
			this.emit(FlatCacheEvents.ERROR, error);
		}
	}

	/**
	 * Remove the file where the cache is persisted
	 * @method removeCacheFile
	 * @return {Boolean} true or false if the file was successfully deleted
	 */
	public removeCacheFile() {
		try {
			if (fs.existsSync(this.cacheFilePath)) {
				fs.rmSync(this.cacheFilePath);
				return true;
			}
		/* c8 ignore next 4 */
		} catch (error) {
			this.emit(FlatCacheEvents.ERROR, error);
		}

		return false;
	}

	/**
	 * Destroy the cache. This will remove the directory, file, and memory cache
	 * @method destroy
	 * @param [includeCacheDir=false] {Boolean} if true, the cache directory will be removed
	 * @return {undefined}
	 */
	public destroy(includeCacheDirectory = false) {
		try {
			this._cache.clear();
			this.stopAutoPersist();
			if (includeCacheDirectory) {
				fs.rmSync(this.cacheDirPath, {recursive: true, force: true});
			} else {
				fs.rmSync(this.cacheFilePath, {recursive: true, force: true});
			}

			this._changesSinceLastSave = false;
			this.emit(FlatCacheEvents.DESTROY);
		/* c8 ignore next 4 */
		} catch (error) {
			this.emit(FlatCacheEvents.ERROR, error);
		}
	}

	/**
	 * Start the auto persist interval
	 * @method startAutoPersist
	 */
	public startAutoPersist() {
		if (this._persistInterval > 0) {
			if (this._persistTimer) {
				clearInterval(this._persistTimer);
				this._persistTimer = undefined;
			}

			this._persistTimer = setInterval(() => {
				this.save();
			}, this._persistInterval);
		}
	}

	/**
	 * Stop the auto persist interval
	 * @method stopAutoPersist
	 */
	public stopAutoPersist() {
		if (this._persistTimer) {
			clearInterval(this._persistTimer);
			this._persistTimer = undefined;
		}
	}
}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class, unicorn/no-static-only-class
export default class FlatCacheDefault {
	static create = create;
	static createFromFile = createFromFile;
	static clearCacheById = clearCacheById;
	static clearAll = clearAll;
}

/**
 * Load a cache identified by the given Id. If the element does not exists, then initialize an empty
 * cache storage.
 *
 * @method create
 * @param docId {String} the id of the cache, would also be used as the name of the file cache
 * @param cacheDirectory {String} directory for the cache entry
 * @param options {FlatCacheOptions} options for the cache
 * @returns {cache} cache instance
 */
export function create(options?: FlatCacheOptions) {
	const cache = new FlatCache(options);
	cache.load();
	return cache;
}

/**
 * Load a cache from the provided file
 * @method createFromFile
 * @param  {String} filePath the path to the file containing the info for the cache
 * @param options {FlatCacheOptions} options for the cache
 * @returns {cache} cache instance
 */
export function createFromFile(filePath: string, options?: FlatCacheOptions) {
	const cache = new FlatCache(options);
	cache.loadFile(filePath);
	return cache;
}

/**
 * Clear the cache identified by the given Id. This will only remove the cache from disk.
 * @method clearCacheById
 * @param cacheId {String} the id of the cache
 * @param cacheDirectory {String} directory for the cache entry
 */
export function clearCacheById(cacheId: string, cacheDirectory?: string) {
	const cache = new FlatCache({cacheId, cacheDir: cacheDirectory});
	cache.destroy();
}

/**
 * Clear the cache directory
 * @method clearAll
 * @param cacheDir {String} directory for the cache entry
 */
export function clearAll(cacheDirectory?: string) {
	fs.rmSync(cacheDirectory ?? '.cache', {recursive: true, force: true});
}
