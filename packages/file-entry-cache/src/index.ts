import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {FlatCache, createFromFile as createFlatCacheFile, type FlatCacheOptions} from 'flat-cache';

export type FileEntryCacheOptions = {
	currentWorkingDirectory?: string;
	useCheckSum?: boolean;
	cache?: FlatCacheOptions;
};

export type GetFileDescriptorOptions = {
	useCheckSum?: boolean;
	currentWorkingDirectory?: string;
};

export type FileDescriptor = {
	key: string;
	changed?: boolean;
	meta?: any;
	notFound?: boolean;
	err?: Error;
};

export type AnalyzedFiles = {
	changedFiles: string[];
	notFoundFiles: string[];
	notChangedFiles: string[];
};

export function createFromFile(filePath: string, useCheckSum?: boolean, currentWorkingDirectory?: string): FileEntryCache {
	const fname = path.basename(filePath);
	const directory = path.dirname(filePath);
	return create(fname, directory, useCheckSum, currentWorkingDirectory);
}

export function create(cacheId: string, cacheDirectory?: string, useCheckSum?: boolean, currentWorkingDirectory?: string): FileEntryCache {
	const options: FileEntryCacheOptions = {
		currentWorkingDirectory,
		useCheckSum,
		cache: {
			cacheId,
			cacheDir: cacheDirectory,
		},
	};
	return new FileEntryCache(options);
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class, unicorn/no-static-only-class
export default class FileEntryDefault {
	static create = create;
	static createFromFile = createFromFile;
}

export class FileEntryCache {
	private _cache: FlatCache = new FlatCache();
	private _useCheckSum = false;
	private _currentWorkingDirectory: string | undefined;

	constructor(options?: FileEntryCacheOptions) {
		if (options?.cache) {
			if (!options.cache.cacheDir && options.cache.cacheId) {
				const path = options.cache.cacheDir + '/' + options.cache.cacheId;
				this._cache = fs.existsSync(path) ? createFlatCacheFile(path, options.cache) : new FlatCache(options.cache);
			} else {
				this._cache = new FlatCache(options.cache);
			}
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
	 * @method createFileKey
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
	 * Check if the file path is a relative path
	 * @method isRelativePath
	 * @param filePath - The file path to check
	 * @returns {boolean} if the file path is a relative path, false otherwise
	 */
	public isRelativePath(filePath: string): boolean {
		return !path.isAbsolute(filePath);
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
	* @method destroy
	*/
	public destroy() {
		this._cache.destroy();
	}

	/**
	 * Remove and Entry From the Cache
	 * @method removeEntry
	 * @param filePath - The file path to remove from the cache
	 */
	public removeEntry(filePath: string) {
		this._cache.removeKey(this.createFileKey(filePath));
	}

	/**
	 * Reconcile the cache
	 * @method reconcile
	 */
	public reconcile(): void {
		const items = this._cache.items;
		for (const item of items) {
			const fileDescriptor = this.getFileDescriptor(item.key);
			if (fileDescriptor.notFound) {
				this._cache.removeKey(item.key);
			}
		}

		this._cache.save();
	}

	/**
	 * Check if the file has changed
	 * @method hasFileChanged
	 * @param filePath - The file path to check
	 * @returns {boolean} if the file has changed, false otherwise
	 */
	public hasFileChanged(filePath: string): boolean {
		let result = false;
		const fileDescriptor = this.getFileDescriptor(filePath);
		if ((!fileDescriptor.err || !fileDescriptor.notFound) && fileDescriptor.changed) {
			result = true;
		}

		return result;
	}

	/**
	 * Get the file descriptor for the file path
	 * @method getFileDescriptor
	 * @param filePath - The file path to get the file descriptor for
	 * @param options - The options for getting the file descriptor
	 * @returns The file descriptor
	 */
	public getFileDescriptor(filePath: string, options?: GetFileDescriptorOptions): FileDescriptor {
		let fstat: fs.Stats;
		const result: FileDescriptor = {
			key: this.createFileKey(filePath),
			changed: false,
		};

		// Set the file path
		if (this.isRelativePath(filePath) && (options?.currentWorkingDirectory ?? this._currentWorkingDirectory)) {
			const currentWorkingDirectory = options?.currentWorkingDirectory ?? this._currentWorkingDirectory;
			if (currentWorkingDirectory) {
				filePath = path.resolve(currentWorkingDirectory, filePath);
			}
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
			return {key: result.key, err: error as Error, notFound: true};
		}

		const useCheckSumValue = options?.useCheckSum ?? this._useCheckSum;

		// Add in the checksum selected
		if (useCheckSumValue) {
			try {
				const buffer = fs.readFileSync(filePath);
				result.meta ||= {};
				result.meta.hash = this.getHash(buffer);
			} catch (error) {
				// If there is an error, remove the file from the cache
				this.removeEntry(filePath);
				return {key: result.key, err: error as Error, notFound: true};
			}
		}

		if (!result.notFound && !result.err) {
			// Check if the file is in the cache
			const cacheFileDescriptor = this._cache.getKey<FileDescriptor>(result.key);
			// If the file is not in the cache, add it
			if (!cacheFileDescriptor) {
				result.changed = true;
				this._cache.setKey(result.key, result);
				return result;
			}

			// If the file is in the cache, check if the file has changed
			if (useCheckSumValue && cacheFileDescriptor.meta.hash !== result.meta.hash) {
				result.changed = true;
				this._cache.setKey(result.key, result);
			} else if (cacheFileDescriptor.meta?.mtime !== result.meta?.mtime || cacheFileDescriptor.meta?.size !== result.meta?.size) {
				result.changed = true;
				this._cache.setKey(result.key, result);
			}
		}

		return result;
	}

	/**
	 * Get the file descriptors for the files
	 * @method normalizeEntries
	 * @param files - The files to get the file descriptors for
	 * @returns The file descriptors
	 */
	public normalizeEntries(files: string[]): FileDescriptor[] {
		return files.map(file => this.getFileDescriptor(file));
	}

	/**
	 * Analyze the files
	 * @method analyzeFiles
	 * @param files - The files to analyze
	 * @returns {AnalyzedFiles} The analysis of the files
	 */
	public analyzeFiles(files: string[]): AnalyzedFiles {
		const result: AnalyzedFiles = {
			changedFiles: [],
			notFoundFiles: [],
			notChangedFiles: [],
		};

		const fileDescriptors = this.normalizeEntries(files);
		for (const fileDescriptor of fileDescriptors) {
			if (fileDescriptor.notFound) {
				result.notFoundFiles.push(fileDescriptor.key);
			} else if (fileDescriptor.changed) {
				result.changedFiles.push(fileDescriptor.key);
			} else {
				result.notChangedFiles.push(fileDescriptor.key);
			}
		}

		return result;
	}

	/**
	 * Get the updated files
	 * @method getUpdatedFiles
	 * @param files - The files to get the updated files for
	 * @returns {string[]} The updated files
	 */
	public getUpdatedFiles(files: string[]): string[] {
		const result = new Array<string>();

		const fileDescriptors = this.normalizeEntries(files);
		for (const fileDescriptor of fileDescriptors) {
			if (fileDescriptor.changed) {
				result.push(fileDescriptor.key);
			}
		}

		return result;
	}
}
