import type { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
	createFromFile as createFlatCacheFile,
	FlatCache,
	type FlatCacheOptions,
} from "flat-cache";

export type ILogger = {
	/** Current log level */
	level?: string;
	/** Trace level logging */
	trace: (message: string | object, ...args: unknown[]) => void;
	/** Debug level logging */
	debug: (message: string | object, ...args: unknown[]) => void;
	/** Info level logging */
	info: (message: string | object, ...args: unknown[]) => void;
	/** Warning level logging */
	warn: (message: string | object, ...args: unknown[]) => void;
	/** Error level logging */
	error: (message: string | object, ...args: unknown[]) => void;
	/** Fatal level logging */
	fatal: (message: string | object, ...args: unknown[]) => void;
};

export type FileEntryCacheOptions = {
	/** Whether to use file modified time for change detection (default: true) */
	useModifiedTime?: boolean;
	/** Whether to use checksum for change detection (default: false) */
	useCheckSum?: boolean;
	/** Hash algorithm to use for checksum (default: 'md5') */
	hashAlgorithm?: string;
	/** Current working directory for resolving relative paths (default: process.cwd()) */
	cwd?: string;
	/** Restrict file access to within cwd boundaries (default: true) */
	restrictAccessToCwd?: boolean;
	/** Whether to use absolute path as cache key (default: false) */
	useAbsolutePathAsKey?: boolean;
	/** Logger instance for logging (default: undefined) */
	logger?: ILogger;
	/** Options for the underlying flat cache */
	cache?: FlatCacheOptions;
};

export type GetFileDescriptorOptions = {
	/** Whether to use checksum for this specific file check instead of modified time (mtime) (overrides instance setting) */
	useCheckSum?: boolean;
	/** Whether to use file modified time for change detection (default: true) */
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
	/** Allow any additional custom properties */
	[key: string]: unknown;
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
 * @param options - create options such as useChecksum, cwd, and more
 * @returns A new FileEntryCache instance
 */
export function createFromFile(
	filePath: string,
	options?: CreateOptions,
): FileEntryCache {
	const fname = path.basename(filePath);
	const directory = path.dirname(filePath);
	return create(fname, directory, options);
}

export type CreateOptions = Omit<FileEntryCacheOptions, "cache">;

/**
 * Create a new FileEntryCache instance
 * @param cacheId - The cache file name
 * @param cacheDirectory - The directory to store the cache file (default: undefined, cache won't be persisted)
 * @param options - Whether to use checksum to detect file changes (default: false)
 * @returns A new FileEntryCache instance
 */
export function create(
	cacheId: string,
	cacheDirectory?: string,
	options?: CreateOptions,
): FileEntryCache {
	const opts: FileEntryCacheOptions = {
		...options,
		cache: {
			cacheId,
			cacheDir: cacheDirectory,
		},
	};

	const fileEntryCache = new FileEntryCache(opts);

	if (cacheDirectory) {
		const cachePath = `${cacheDirectory}/${cacheId}`;
		if (fs.existsSync(cachePath)) {
			fileEntryCache.cache = createFlatCacheFile(cachePath, opts.cache);
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
	private _hashAlgorithm = "md5";
	private _cwd: string = process.cwd();
	private _restrictAccessToCwd = false;
	private _logger?: ILogger;
	private _useAbsolutePathAsKey = false;
	private _useModifiedTime = true;

	/**
	 * Create a new FileEntryCache instance
	 * @param options - The options for the FileEntryCache (all properties are optional with defaults)
	 */
	constructor(options?: FileEntryCacheOptions) {
		if (options?.cache) {
			this._cache = new FlatCache(options.cache);
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

		if (options?.useModifiedTime !== undefined) {
			this._useModifiedTime = options.useModifiedTime;
		}

		if (options?.restrictAccessToCwd !== undefined) {
			this._restrictAccessToCwd = options.restrictAccessToCwd;
		}

		if (options?.useAbsolutePathAsKey !== undefined) {
			this._useAbsolutePathAsKey = options.useAbsolutePathAsKey;
		}

		if (options?.logger) {
			this._logger = options.logger;
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
	 * Get the logger
	 * @returns {ILogger | undefined} The logger instance
	 */
	public get logger(): ILogger | undefined {
		return this._logger;
	}

	/**
	 * Set the logger
	 * @param {ILogger | undefined} logger - The logger to set
	 */
	public set logger(logger: ILogger | undefined) {
		this._logger = logger;
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
	 * Get whether to use modified time for change detection
	 * @returns {boolean} Whether modified time (mtime) is used for change detection (default: true)
	 */
	public get useModifiedTime(): boolean {
		return this._useModifiedTime;
	}

	/**
	 * Set whether to use modified time for change detection
	 * @param {boolean} value - The value to set
	 */
	public set useModifiedTime(value: boolean) {
		this._useModifiedTime = value;
	}

	/**
	 * Get whether to restrict paths to cwd boundaries
	 * @returns {boolean} Whether strict path checking is enabled (default: true)
	 */
	public get restrictAccessToCwd(): boolean {
		return this._restrictAccessToCwd;
	}

	/**
	 * Set whether to restrict paths to cwd boundaries
	 * @param {boolean} value - The value to set
	 */
	public set restrictAccessToCwd(value: boolean) {
		this._restrictAccessToCwd = value;
	}

	/**
	 * Get whether to use absolute path as cache key
	 * @returns {boolean} Whether cache keys use absolute paths (default: false)
	 */
	public get useAbsolutePathAsKey(): boolean {
		return this._useAbsolutePathAsKey;
	}

	/**
	 * Set whether to use absolute path as cache key
	 * @param {boolean} value - The value to set
	 */
	public set useAbsolutePathAsKey(value: boolean) {
		this._useAbsolutePathAsKey = value;
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
		let result = filePath;

		if (this._useAbsolutePathAsKey && this.isRelativePath(filePath)) {
			result = this.getAbsolutePathWithCwd(filePath, this._cwd);
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
		this._logger?.debug({ filePath, options }, "Getting file descriptor");

		let fstat: fs.Stats;
		const result: FileDescriptor = {
			key: this.createFileKey(filePath),
			changed: false,
			meta: {},
		};

		this._logger?.trace({ key: result.key }, "Created file key");

		const metaCache = this._cache.getKey<FileDescriptorMeta>(result.key);

		if (metaCache) {
			this._logger?.trace({ metaCache }, "Found cached meta");
		} else {
			this._logger?.trace("No cached meta found");
		}

		// Start with cached meta to preserve custom properties
		result.meta = metaCache ? { ...metaCache } : {};

		// Convert to absolute path for file system operations
		const absolutePath = this.getAbsolutePath(filePath);
		this._logger?.trace({ absolutePath }, "Resolved absolute path");

		const useCheckSumValue = options?.useCheckSum ?? this._useCheckSum;
		this._logger?.debug(
			{ useCheckSum: useCheckSumValue },
			"Using checksum setting",
		);

		const useModifiedTimeValue =
			options?.useModifiedTime ?? this.useModifiedTime;
		this._logger?.debug(
			{ useModifiedTime: useModifiedTimeValue },
			"Using modified time (mtime) setting",
		);

		try {
			fstat = fs.statSync(absolutePath);
			// Update the file stats while preserving existing meta properties
			result.meta.size = fstat.size;
			result.meta.mtime = fstat.mtime.getTime();

			this._logger?.trace(
				{ size: result.meta.size, mtime: result.meta.mtime },
				"Read file stats",
			);

			if (useCheckSumValue) {
				// Get the file hash
				const buffer = fs.readFileSync(absolutePath);
				result.meta.hash = this.getHash(buffer);
				this._logger?.trace({ hash: result.meta.hash }, "Calculated file hash");
			}
		} catch (error) {
			this._logger?.error({ filePath, error }, "Error reading file");
			this.removeEntry(filePath);
			let notFound = false;
			if ((error as Error).message.includes("ENOENT")) {
				notFound = true;
				this._logger?.debug({ filePath }, "File not found");
			}

			return {
				key: result.key,
				err: error as Error,
				notFound,
				meta: {},
			};
		}

		// If the file is not in the cache, add it
		if (!metaCache) {
			result.changed = true;
			this._cache.setKey(result.key, result.meta);
			this._logger?.debug({ filePath }, "File not in cache, marked as changed");
			return result;
		}

		// If the file is in the cache, check if the file has changed
		if (useModifiedTimeValue && metaCache?.mtime !== result.meta?.mtime) {
			result.changed = true;
			this._logger?.debug(
				{ filePath, oldMtime: metaCache.mtime, newMtime: result.meta.mtime },
				"File changed: mtime differs",
			);
		}

		if (metaCache?.size !== result.meta?.size) {
			result.changed = true;
			this._logger?.debug(
				{ filePath, oldSize: metaCache.size, newSize: result.meta.size },
				"File changed: size differs",
			);
		}

		if (useCheckSumValue && metaCache?.hash !== result.meta?.hash) {
			result.changed = true;
			this._logger?.debug(
				{ filePath, oldHash: metaCache.hash, newHash: result.meta.hash },
				"File changed: hash differs",
			);
		}

		this._cache.setKey(result.key, result.meta);

		if (result.changed) {
			this._logger?.info({ filePath }, "File has changed");
		} else {
			this._logger?.debug({ filePath }, "File unchanged");
		}

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
			/* v8 ignore next -- @preserve */
			if (key.startsWith(filePath)) {
				const fileDescriptor = this.getFileDescriptor(key);
				result.push(fileDescriptor);
			}
		}

		return result;
	}

	/**
	 * Get the Absolute Path. If it is already absolute it will return the path as is.
	 * When restrictAccessToCwd is enabled, ensures the resolved path stays within cwd boundaries.
	 * @method getAbsolutePath
	 * @param filePath - The file path to get the absolute path for
	 * @returns {string}
	 * @throws {Error} When restrictAccessToCwd is true and path would resolve outside cwd
	 */
	public getAbsolutePath(filePath: string): string {
		if (this.isRelativePath(filePath)) {
			// Sanitize the path to remove any null bytes
			const sanitizedPath = filePath.replace(/\0/g, "");

			// Resolve the path - this handles all .. and . sequences correctly
			const resolved = path.resolve(this._cwd, sanitizedPath);

			// Check if strict path checking is enabled
			if (this._restrictAccessToCwd) {
				// Normalize both paths for comparison to handle edge cases
				const normalizedResolved = path.normalize(resolved);
				const normalizedCwd = path.normalize(this._cwd);

				// Check if the resolved path is within the cwd boundaries
				// We need to handle both the case where it equals cwd and where it's a subdirectory
				const isWithinCwd =
					normalizedResolved === normalizedCwd ||
					normalizedResolved.startsWith(normalizedCwd + path.sep);

				if (!isWithinCwd) {
					throw new Error(
						`Path traversal attempt blocked: "${filePath}" resolves outside of working directory "${this._cwd}"`,
					);
				}
			}

			return resolved;
		}
		return filePath;
	}

	/**
	 * Get the Absolute Path with a custom working directory. If it is already absolute it will return the path as is.
	 * When restrictAccessToCwd is enabled, ensures the resolved path stays within the provided cwd boundaries.
	 * @method getAbsolutePathWithCwd
	 * @param filePath - The file path to get the absolute path for
	 * @param cwd - The custom working directory to resolve relative paths from
	 * @returns {string}
	 * @throws {Error} When restrictAccessToCwd is true and path would resolve outside the provided cwd
	 */
	public getAbsolutePathWithCwd(filePath: string, cwd: string): string {
		if (this.isRelativePath(filePath)) {
			// Sanitize the path to remove any null bytes
			const sanitizedPath = filePath.replace(/\0/g, "");

			// Resolve the path - this handles all .. and . sequences correctly
			const resolved = path.resolve(cwd, sanitizedPath);

			// Check if strict path checking is enabled
			if (this._restrictAccessToCwd) {
				// Normalize both paths for comparison to handle edge cases
				const normalizedResolved = path.normalize(resolved);
				const normalizedCwd = path.normalize(cwd);

				// Check if the resolved path is within the cwd boundaries
				// We need to handle both the case where it equals cwd and where it's a subdirectory
				const isWithinCwd =
					normalizedResolved === normalizedCwd ||
					normalizedResolved.startsWith(normalizedCwd + path.sep);

				if (!isWithinCwd) {
					throw new Error(
						`Path traversal attempt blocked: "${filePath}" resolves outside of working directory "${cwd}"`,
					);
				}
			}

			return resolved;
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
			/* v8 ignore next -- @preserve */
			if (key.startsWith(oldPath)) {
				const newKey = key.replace(oldPath, newPath);
				const meta = this._cache.getKey(key);
				this._cache.removeKey(key);
				this._cache.setKey(newKey, meta);
			}
		}
	}
}
