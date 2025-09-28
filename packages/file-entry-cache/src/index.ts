import type { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
	createFromFile as createFlatCacheFile,
	FlatCache,
	type FlatCacheOptions,
} from "flat-cache";

export type FileEntryCacheOptions = {
	/** Whether to use file modified time for change detection (default: true) */
	useModifiedTime?: boolean;
	/** Whether to use checksum for change detection (default: false) */
	useCheckSum?: boolean;
	/** Hash algorithm to use for checksum (default: 'md5') */
	hashAlgorithm?: string;
	/** Current working directory for resolving relative paths (default: process.cwd()) */
	cwd?: string;
	/** Options for the underlying flat cache */
	cache?: FlatCacheOptions;
};

export type GetFileDescriptorOptions = {
	/** Whether to use checksum for this specific file check (overrides instance setting) */
	useCheckSum?: boolean;
	/** Whether to use modified time for this specific file check (overrides instance setting) */
	useModifiedTime?: boolean;
};

export type FileDescriptor = {
	/** The cache key for this file (typically the file path) */
	key: string;
	/** Whether the file has changed since last cache check */
	changed?: boolean;
	/** Metadata about the file */
	meta: FileDescriptorMeta;
	/** Whether the file was not found */
	notFound?: boolean;
	/** Error encountered when accessing the file */
	err?: Error;
};

export type FileDescriptorMeta = {
	/** File size in bytes */
	size?: number;
	/** File modification time (timestamp in milliseconds) */
	mtime?: number;
	/** File content hash (when useCheckSum is enabled) */
	hash?: string;
	/** Custom data associated with the file (e.g., lint results, metadata) */
	data?: unknown;
};

export type AnalyzedFiles = {
	/** Array of file paths that have changed since last cache */
	changedFiles: string[];
	/** Array of file paths that were not found */
	notFoundFiles: string[];
	/** Array of file paths that have not changed since last cache */
	notChangedFiles: string[];
};

/**
 * Create a new FileEntryCache instance from a file path
 * @param filePath - The path to the cache file
 * @param useCheckSum - Whether to use checksum to detect file changes (default: false)
 * @param cwd - The current working directory for resolving relative paths (default: process.cwd())
 * @returns A new FileEntryCache instance
 */
export function createFromFile(
	filePath: string,
	useCheckSum?: boolean,
	cwd?: string,
): FileEntryCache {
	const fname = path.basename(filePath);
	const directory = path.dirname(filePath);
	return create(fname, directory, useCheckSum, cwd);
}

/**
 * Create a new FileEntryCache instance
 * @param cacheId - The cache file name
 * @param cacheDirectory - The directory to store the cache file (default: undefined, cache won't be persisted)
 * @param useCheckSum - Whether to use checksum to detect file changes (default: false)
 * @param cwd - The current working directory for resolving relative paths (default: process.cwd())
 * @returns A new FileEntryCache instance
 */
export function create(
	cacheId: string,
	cacheDirectory?: string,
	useCheckSum?: boolean,
	cwd?: string,
): FileEntryCache {
	const options: FileEntryCacheOptions = {
		useCheckSum,
		cwd,
		cache: {
			cacheId,
			cacheDir: cacheDirectory,
		},
	};

	const fileEntryCache = new FileEntryCache(options);

	if (cacheDirectory) {
		const cachePath = `${cacheDirectory}/${cacheId}`;
		if (fs.existsSync(cachePath)) {
			fileEntryCache.cache = createFlatCacheFile(cachePath, options.cache);
		}
	}

	return fileEntryCache;
}

// biome-ignore lint/complexity/noStaticOnlyClass: legacy
export default class FileEntryDefault {
	static create = create;
	static createFromFile = createFromFile;
}

export class FileEntryCache {
	private _cache: FlatCache = new FlatCache({ useClone: false });
	private _useCheckSum = false;
	private _useModifiedTime = true;
	private _hashAlgorithm = "md5";
	private _cwd: string = process.cwd();

	/**
	 * Create a new FileEntryCache instance
	 * @param options - The options for the FileEntryCache (all properties are optional with defaults)
	 */
	constructor(options?: FileEntryCacheOptions) {
		if (options?.cache) {
			this._cache = new FlatCache(options.cache);
		}

		if (options?.useModifiedTime) {
			this._useModifiedTime = options.useModifiedTime;
		}

		if (options?.useCheckSum) {
			this._useCheckSum = options.useCheckSum;
		}

		if (options?.hashAlgorithm) {
			this._hashAlgorithm = options.hashAlgorithm;
		}

		if (options?.cwd) {
			this._cwd = options.cwd;
		}
	}

	/**
	 * Get the cache
	 * @returns {FlatCache} The cache
	 */
	public get cache(): FlatCache {
		return this._cache;
	}

	/**
	 * Set the cache
	 * @param {FlatCache} cache - The cache to set
	 */
	public set cache(cache: FlatCache) {
		this._cache = cache;
	}

	/**
	 * Use the hash to check if the file has changed
	 * @returns {boolean} if the hash is used to check if the file has changed (default: false)
	 */
	public get useCheckSum(): boolean {
		return this._useCheckSum;
	}

	/**
	 * Set the useCheckSum value
	 * @param {boolean} value - The value to set
	 */
	public set useCheckSum(value: boolean) {
		this._useCheckSum = value;
	}

	/**
	 * Use the modified time to check if the file has changed
	 * @returns {boolean} if the modified time is used to check if the file has changed (default: true)
	 */
	public get useModifiedTime(): boolean {
		return this._useModifiedTime;
	}

	/**
	 * Set the useModifiedTime value
	 * @param {boolean} value - The value to set
	 */
	public set useModifiedTime(value: boolean) {
		this._useModifiedTime = value;
	}

	/**
	 * Get the hash algorithm
	 * @returns {string} The hash algorithm (default: 'md5')
	 */
	public get hashAlgorithm(): string {
		return this._hashAlgorithm;
	}

	/**
	 * Set the hash algorithm
	 * @param {string} value - The value to set
	 */
	public set hashAlgorithm(value: string) {
		this._hashAlgorithm = value;
	}

	/**
	 * Get the current working directory
	 * @returns {string} The current working directory (default: process.cwd())
	 */
	public get cwd(): string {
		return this._cwd;
	}

	/**
	 * Set the current working directory
	 * @param {string} value - The value to set
	 */
	public set cwd(value: string) {
		this._cwd = value;
	}

	/**
	 * Given a buffer, calculate md5 hash of its content.
	 * @method getHash
	 * @param  {Buffer} buffer   buffer to calculate hash on
	 * @return {String}          content hash digest
	 */
	public getHash(buffer: Buffer): string {
		return crypto.createHash(this._hashAlgorithm).update(buffer).digest("hex");
	}

	/**
	 * Create the key for the file path used for caching.
	 * @method createFileKey
	 * @param {String} filePath
	 * @return {String}
	 */
	public createFileKey(filePath: string): string {
		return filePath;
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
	public removeEntry(filePath: string): void {
		const key = this.createFileKey(filePath);
		this._cache.removeKey(key);
	}

	/**
	 * Reconcile the cache
	 * @method reconcile
	 */
	public reconcile(): void {
		const { items } = this._cache;
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
		if (
			(!fileDescriptor.err || !fileDescriptor.notFound) &&
			fileDescriptor.changed
		) {
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
	public getFileDescriptor(
		filePath: string,
		options?: GetFileDescriptorOptions,
	): FileDescriptor {
		let fstat: fs.Stats;
		const result: FileDescriptor = {
			key: this.createFileKey(filePath),
			changed: false,
			meta: {},
		};

		result.meta = this._cache.getKey<FileDescriptorMeta>(result.key) ?? {};

		// Convert to absolute path for file system operations
		const absolutePath = this.getAbsolutePath(filePath);

		const useCheckSumValue = options?.useCheckSum ?? this._useCheckSum;
		const useModifiedTimeValue =
			options?.useModifiedTime ?? this._useModifiedTime;

		try {
			fstat = fs.statSync(absolutePath);
			// Get the file size
			result.meta = {
				size: fstat.size,
			};
			// Get the file modification time
			result.meta.mtime = fstat.mtime.getTime();

			if (useCheckSumValue) {
				// Get the file hash
				const buffer = fs.readFileSync(absolutePath);
				result.meta.hash = this.getHash(buffer);
			}
		} catch (error) {
			this.removeEntry(filePath);
			let notFound = false;
			if ((error as Error).message.includes("ENOENT")) {
				notFound = true;
			}

			return {
				key: result.key,
				err: error as Error,
				notFound,
				meta: {},
			};
		}

		const metaCache = this._cache.getKey<FileDescriptorMeta>(result.key);

		// If the file is not in the cache, add it
		if (!metaCache) {
			result.changed = true;
			this._cache.setKey(result.key, result.meta);
			return result;
		}

		// Set the data from the cache
		if (result.meta.data === undefined) {
			result.meta.data = metaCache.data;
		}

		// If the file is in the cache, check if the file has changed
		/* c8 ignore next 3 */
		if (useModifiedTimeValue && metaCache?.mtime !== result.meta?.mtime) {
			result.changed = true;
		}

		if (metaCache?.size !== result.meta?.size) {
			result.changed = true;
		}

		if (useCheckSumValue && metaCache?.hash !== result.meta?.hash) {
			result.changed = true;
		}

		this._cache.setKey(result.key, result.meta);

		return result;
	}

	/**
	 * Get the file descriptors for the files
	 * @method normalizeEntries
	 * @param files?: string[] - The files to get the file descriptors for
	 * @returns The file descriptors
	 */
	public normalizeEntries(files?: string[]): FileDescriptor[] {
		const result: FileDescriptor[] = [];
		if (files) {
			for (const file of files) {
				const fileDescriptor = this.getFileDescriptor(file);
				result.push(fileDescriptor);
			}

			return result;
		}

		const keys = this.cache.keys();
		for (const key of keys) {
			const fileDescriptor = this.getFileDescriptor(key);
			if (!fileDescriptor.notFound && !fileDescriptor.err) {
				result.push(fileDescriptor);
			}
		}

		return result;
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
		const result: string[] = [];

		const fileDescriptors = this.normalizeEntries(files);
		for (const fileDescriptor of fileDescriptors) {
			if (fileDescriptor.changed) {
				result.push(fileDescriptor.key);
			}
		}

		return result;
	}

	/**
	 * Get the file descriptors by path prefix
	 * @method getFileDescriptorsByPath
	 * @param filePath - the path prefix to match
	 * @returns {FileDescriptor[]} The file descriptors
	 */
	public getFileDescriptorsByPath(filePath: string): FileDescriptor[] {
		const result: FileDescriptor[] = [];
		const keys = this._cache.keys();
		for (const key of keys) {
			if (key.startsWith(filePath)) {
				const fileDescriptor = this.getFileDescriptor(key);
				result.push(fileDescriptor);
			}
		}

		return result;
	}

	/**
	 * Get the Absolute Path. If it is already absolute it will return the path as is.
	 * @method getAbsolutePath
	 * @param filePath - The file path to get the absolute path for
	 * @returns {string}
	 */
	public getAbsolutePath(filePath: string): string {
		if (this.isRelativePath(filePath)) {
			return path.resolve(this._cwd, filePath);
		}
		return filePath;
	}

	/**
	 * Get the Absolute Path with a custom working directory. If it is already absolute it will return the path as is.
	 * @method getAbsolutePathWithCwd
	 * @param filePath - The file path to get the absolute path for
	 * @param cwd - The custom working directory to resolve relative paths from
	 * @returns {string}
	 */
	public getAbsolutePathWithCwd(filePath: string, cwd: string): string {
		if (this.isRelativePath(filePath)) {
			return path.resolve(cwd, filePath);
		}
		return filePath;
	}

	/**
	 * Rename cache keys that start with a given path prefix.
	 * @method renameCacheKeys
	 * @param oldPath - The old path prefix to rename
	 * @param newPath - The new path prefix to rename to
	 */
	public renameCacheKeys(oldPath: string, newPath: string): void {
		const keys = this._cache.keys();
		for (const key of keys) {
			if (key.startsWith(oldPath)) {
				const newKey = key.replace(oldPath, newPath);
				const meta = this._cache.getKey(key);
				this._cache.removeKey(key);
				this._cache.setKey(newKey, meta);
			}
		}
	}
}
