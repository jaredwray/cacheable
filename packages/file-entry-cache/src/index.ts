import crypto from 'node:crypto';
import fs from 'node:fs';
import {FlatCache, type FlatCacheOptions} from 'flat-cache';

export type FileEntryCacheOptions = {
	currentWorkingDirectory?: string;
	useCheckSum?: boolean;
	cache?: FlatCacheOptions;
};

export type GetFileDescriptorOptions = {
	useCheckSum?: boolean;
	useCurrentWorkingDirectory?: boolean;
};

export type FileDescriptor = {
	key: string;
	changed?: boolean;
	hash?: string;
	meta?: {
		size?: number;
		mtime?: number;
		data?: unknown;
	};
	notFound?: boolean;
	err?: Error;
	isRelative?: boolean;
};

export function create(): FileEntryCache {
	return new FileEntryCache();
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class, unicorn/no-static-only-class
export default class FileEntryDefault {
	static create = create;
}

export class FileEntryCache {
	private _cache: FlatCache = new FlatCache();
	private _useCheckSum = false;
	private _currentWorkingDirectory: string | undefined;

	constructor(options?: FileEntryCacheOptions) {
		if (options?.cache) {
			this._cache = new FlatCache(options.cache);
		}

		if (options?.useCheckSum) {
			this._useCheckSum = options.useCheckSum;
		}

		if (options?.currentWorkingDirectory) {
			this._currentWorkingDirectory = options.currentWorkingDirectory;
		}
	}

	public get cache(): FlatCache {
		return this._cache;
	}

	public set cache(cache: FlatCache) {
		this._cache = cache;
	}

	public get useCheckSum(): boolean {
		return this._useCheckSum;
	}

	public set useCheckSum(value: boolean) {
		this._useCheckSum = value;
	}

	public get currentWorkingDirectory(): string | undefined {
		return this._currentWorkingDirectory;
	}

	public set currentWorkingDirectory(value: string | undefined) {
		this._currentWorkingDirectory = value;
	}

	/**
	 * Given a buffer, calculate md5 hash of its content.
	 * @method getHash
	 * @param  {Buffer} buffer   buffer to calculate hash on
	 * @return {String}          content hash digest
	 */
	// eslint-disable-next-line @typescript-eslint/ban-types
	public getHash(buffer: Buffer): string {
		return crypto.createHash('md5').update(buffer).digest('hex');
	}

	/**
	 * Create the key for the file path used for caching.
	 * @param {String} filePath
	 * @return {String}
	 */
	public createFileKey(filePath: string): string {
		let result = filePath;
		if (this._currentWorkingDirectory) {
			const splitPath = filePath.split(this._currentWorkingDirectory).pop();
			if (splitPath) {
				result = splitPath;
			}
		}

		return result;
	}

	/**
	* Delete the cache file from the disk
	* @method deleteCacheFile
	* @return {boolean}       true if the file was deleted, false otherwise
	*/
	public deleteCacheFile(): boolean {
		return this._cache.removeCacheFile();
	}

	/**
	* Remove the cache from the file and clear the memory cache
	*/
	public destroy() {
		this._cache.destroy();
	}

	/**
	 * Remove and Entry From the Cache
	 * @param filePath - The file path to remove from the cache
	 */
	public removeEntry(filePath: string) {
		this._cache.removeKey(this.createFileKey(filePath));
	}

	/**
	 * Reconcile the cache
	 */
	public reconcile(): void {
		this._cache.save();
	}

	public getFileDescriptor(filePath: string, options?: GetFileDescriptorOptions): FileDescriptor {
		let fstat: fs.Stats;
		const result: FileDescriptor = {
			key: this.createFileKey(filePath),
			changed: false,
		};

		if (this._currentWorkingDirectory && options?.useCurrentWorkingDirectory !== false) {
			filePath = `${this._currentWorkingDirectory}/${filePath}`;
			result.isRelative = true;
		}

		try {
			fstat = fs.statSync(filePath);
			// Get the file size
			result.meta = {
				size: fstat.size,
			};
			// Get the file modification time
			result.meta.mtime = fstat.mtime.getTime();
		} catch (error) {
			this.removeEntry(filePath);
			result.notFound = true;
			result.err = error as Error;
		}

		const useCheckSumValue = options?.useCheckSum ?? this._useCheckSum;

		// Add in the checksum selected
		if (useCheckSumValue) {
			try {
				const buffer = fs.readFileSync(filePath);
				result.hash = this.getHash(buffer);
			} catch (error) {
				// If there is an error, remove the file from the cache
				this.removeEntry(filePath);
				result.notFound = true;
				result.err = error as Error;
			}
		}

		// Check if the file is in the cache
		const cacheFileDescriptor = this._cache.getKey<FileDescriptor>(result.key);
		// If the file is not in the cache, add it
		if (!cacheFileDescriptor) {
			result.changed = true;
			this._cache.setKey(result.key, result);
			return result;
		}

		// If the file is in the cache, check if the file has changed
		if (useCheckSumValue && cacheFileDescriptor.hash !== result.hash) {
			result.changed = true;
			this._cache.setKey(result.key, result);
		} else if (cacheFileDescriptor.meta?.mtime !== result.meta?.mtime || cacheFileDescriptor.meta?.size !== result.meta?.size) {
			result.changed = true;
			this._cache.setKey(result.key, result);
		}

		return result;
	}
}
