import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";
import defaultFileEntryCache, {
	createFromFile,
	FileEntryCache,
	type FileEntryCacheOptions,
} from "../src/index.js";

describe("file-entry-cache with options", () => {
	test("should initialize", () => {
		const fileEntryCache = new FileEntryCache();
		expect(fileEntryCache).toBeDefined();
	});

	test("should be able to set flat-cache options", () => {
		const fileEntryCache = new FileEntryCache({ cache: { cacheId: "test" } });
		expect(fileEntryCache.cache.cacheId).toBe("test");
	});

	test("should be able to get and set FlatCache", () => {
		const fileEntryCache = new FileEntryCache();
		const newFileEntryCache = new FileEntryCache();
		fileEntryCache.cache = newFileEntryCache.cache;
		expect(fileEntryCache.cache).toBe(newFileEntryCache.cache);
	});

	test("should be able to get and set useCheckSum", () => {
		const fileEntryCache = new FileEntryCache({ useCheckSum: true });
		expect(fileEntryCache.useCheckSum).toBe(true);
		fileEntryCache.useCheckSum = false;
		expect(fileEntryCache.useCheckSum).toBe(false);
	});

	test("should be able to get and set useAbsolutePathAsKey", () => {
		const fileEntryCache = new FileEntryCache({ useAbsolutePathAsKey: true });
		expect(fileEntryCache.useAbsolutePathAsKey).toBe(true);
		fileEntryCache.useAbsolutePathAsKey = false;
		expect(fileEntryCache.useAbsolutePathAsKey).toBe(false);
	});

	test("should be able to get and set restrictAccessToCwd", () => {
		const fileEntryCache = new FileEntryCache({ restrictAccessToCwd: true });
		expect(fileEntryCache.restrictAccessToCwd).toBe(true);
		fileEntryCache.restrictAccessToCwd = false;
		expect(fileEntryCache.restrictAccessToCwd).toBe(false);
	});

	test("should be able to get and set useModifiedTime", () => {
		const fileEntryCache = new FileEntryCache({ useModifiedTime: false });
		expect(fileEntryCache.useModifiedTime).toBe(false);
		fileEntryCache.useModifiedTime = true;
		expect(fileEntryCache.useModifiedTime).toBe(true);
	});

	test("create should initialize a file-entry-cache", () => {
		const fileEntryCache = defaultFileEntryCache.create("test1");
		expect(fileEntryCache).toBeDefined();
		fs.rmSync(fileEntryCache.cache.cacheDirPath, {
			recursive: true,
			force: true,
		});
	});

	test("should initialize with hashAlgorithm", () => {
		const fileEntryCache = new FileEntryCache({ hashAlgorithm: "sha256" });
		expect(fileEntryCache.hashAlgorithm).toBe("sha256");
		fileEntryCache.hashAlgorithm = "md5";
		expect(fileEntryCache.hashAlgorithm).toBe("md5");
	});

	test("should be able to get and set logger", async () => {
		const pino = await import("pino");
		const logger = pino.default();
		const fileEntryCache = new FileEntryCache();
		expect(fileEntryCache.logger).toBeUndefined();
		fileEntryCache.logger = logger;
		expect(fileEntryCache.logger).toBe(logger);
		expect(fileEntryCache.logger?.info).toBeDefined();
		expect(fileEntryCache.logger?.error).toBeDefined();
		fileEntryCache.logger = undefined;
		expect(fileEntryCache.logger).toBeUndefined();
	});

	test("should initialize with logger in options", async () => {
		const pino = await import("pino");
		const logger = pino.default();
		const fileEntryCache = new FileEntryCache({ logger });
		expect(fileEntryCache.logger).toBe(logger);
		expect(fileEntryCache.logger?.info).toBeDefined();
		expect(fileEntryCache.logger?.error).toBeDefined();
	});

	test("should log detailed information during getFileDescriptor operations", async () => {
		const logs: Array<{ level: string; msg: string; data?: unknown }> = [];

		// Create a mock logger that captures all log calls
		const logger = {
			level: "trace",
			trace: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "trace", msg: message || "", data: logData });
			},
			debug: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "debug", msg: message || "", data: logData });
			},
			info: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "info", msg: message || "", data: logData });
			},
			warn: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "warn", msg: message || "", data: logData });
			},
			error: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "error", msg: message || "", data: logData });
			},
			fatal: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "fatal", msg: message || "", data: logData });
			},
		};

		const testFile = path.join(__dirname, "test-logger-file-unique.txt");

		// Clean up any existing file and cache
		if (fs.existsSync(testFile)) {
			fs.unlinkSync(testFile);
		}

		fs.writeFileSync(testFile, "initial content");

		const fileEntryCache = new FileEntryCache({
			// @ts-expect-error as test
			logger,
			useCheckSum: true,
		});

		// First call - file not in cache
		logs.length = 0;
		let descriptor = fileEntryCache.getFileDescriptor(testFile);

		// Verify logs for first call (lines 380, 389, 396, 404, 407, 418, 427, 450)
		expect(logs.some((l) => l.msg === "Getting file descriptor")).toBe(true); // 380
		expect(logs.some((l) => l.msg === "Created file key")).toBe(true); // 389
		expect(logs.some((l) => l.msg === "No cached meta found")).toBe(true); // 396
		expect(logs.some((l) => l.msg === "Resolved absolute path")).toBe(true); // 404
		expect(logs.some((l) => l.msg === "Using checksum setting")).toBe(true); // 407
		expect(logs.some((l) => l.msg === "Read file stats")).toBe(true); // 418
		expect(logs.some((l) => l.msg === "Calculated file hash")).toBe(true); // 427
		expect(
			logs.some((l) => l.msg === "File not in cache, marked as changed"),
		).toBe(true); // 450

		// Reconcile so the file becomes the cached baseline
		fileEntryCache.reconcile();

		// Second call - file in cache, unchanged
		logs.length = 0;
		descriptor = fileEntryCache.getFileDescriptor(testFile);

		// Verify logs for cached file (lines 394, 485)
		expect(logs.some((l) => l.msg === "Found cached meta")).toBe(true); // 394
		expect(logs.some((l) => l.msg === "File unchanged")).toBe(true); // 485

		// Third call - file changed (size and hash)
		logs.length = 0;
		fs.writeFileSync(testFile, "modified content with different size");
		descriptor = fileEntryCache.getFileDescriptor(testFile);

		// Verify logs for changed file (lines 466, 474, 483)
		expect(logs.some((l) => l.msg === "File changed: size differs")).toBe(true); // 466
		expect(logs.some((l) => l.msg === "File changed: hash differs")).toBe(true); // 474
		expect(logs.some((l) => l.msg === "File has changed")).toBe(true); // 483

		// Fourth call - file not found error
		logs.length = 0;
		fs.unlinkSync(testFile);
		descriptor = fileEntryCache.getFileDescriptor(testFile);

		// Verify logs for error (lines 430, 435)
		expect(logs.some((l) => l.msg === "Error reading file")).toBe(true); // 430
		expect(logs.some((l) => l.msg === "File not found")).toBe(true); // 435
		expect(descriptor.notFound).toBe(true);
	});

	test("should log mtime change when useCheckSum is false", async () => {
		const logs: Array<{ level: string; msg: string; data?: unknown }> = [];

		const logger = {
			level: "trace",
			trace: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "trace", msg: message || "", data: logData });
			},
			debug: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "debug", msg: message || "", data: logData });
			},
			info: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "info", msg: message || "", data: logData });
			},
			warn: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "warn", msg: message || "", data: logData });
			},
			error: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "error", msg: message || "", data: logData });
			},
			fatal: (data: unknown, msg?: string) => {
				const message = typeof data === "string" ? data : msg;
				const logData = typeof data === "string" ? undefined : data;
				logs.push({ level: "fatal", msg: message || "", data: logData });
			},
		};

		const testFile = path.join(__dirname, "test-mtime-logger.txt");

		// Clean up any existing file
		if (fs.existsSync(testFile)) {
			fs.unlinkSync(testFile);
		}

		fs.writeFileSync(testFile, "initial content");

		const fileEntryCache = new FileEntryCache({
			// @ts-expect-error
			logger,
			useCheckSum: false, // Disable checksum to use mtime
		});

		// First call - add file to cache and reconcile to set the baseline
		fileEntryCache.getFileDescriptor(testFile);
		fileEntryCache.reconcile();

		// Wait a bit and modify the file to change mtime
		await new Promise((resolve) => setTimeout(resolve, 10));
		fs.writeFileSync(testFile, "initial content"); // Same content but different mtime

		// Second call - should detect mtime change
		logs.length = 0;
		const descriptor = fileEntryCache.getFileDescriptor(testFile);

		// Verify the mtime change was logged (line 452)
		expect(logs.some((l) => l.msg === "File changed: mtime differs")).toBe(
			true,
		);
		expect(descriptor.changed).toBe(true);

		// Clean up
		fs.unlinkSync(testFile);
	});
});

describe("getHash", () => {
	test("should return a hash", () => {
		const fileEntryCache = new FileEntryCache();
		const buffer = Buffer.from("test");
		const hash = fileEntryCache.getHash(buffer);
		expect(hash).toBeDefined();
	});
	test("empty buffer should return md5 empty hash", () => {
		const fileEntryCache = new FileEntryCache();
		const buffer = Buffer.from("");
		const hash = fileEntryCache.getHash(buffer);
		expect(hash).toBe("d41d8cd98f00b204e9800998ecf8427e"); // Sha256 hash of empty string
	});
});

describe("getFileKey", () => {
	test("should return a key", () => {
		const fileEntryCache = new FileEntryCache();
		const key = fileEntryCache.createFileKey("test");
		expect(key).toBe("test");
	});
	test("should return a correct path key", () => {
		const fileEntryCache = new FileEntryCache();
		const path = "/usr/src/test2/test";
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
	test("should return path as-is for relative paths", () => {
		const fileEntryCache = new FileEntryCache();
		const path = "./test/file.js";
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
	test("should return path as-is for absolute paths", () => {
		const fileEntryCache = new FileEntryCache();
		const path = "/usr/src/test2/file.js";
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
});

describe("destroy()", () => {
	test("should return false to delete the file cache", () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey("foo", "bar");
		expect(fileEntryCache.cache.all()).toEqual({ foo: "bar" });
		fileEntryCache.destroy();
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe("removeEntry()", () => {
	test("should remove entry using exact key match", () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey("test.js", "bar");
		expect(fileEntryCache.cache.all()).toEqual({
			"test.js": "bar",
		});
		fileEntryCache.removeEntry("test.js");
		expect(fileEntryCache.cache.all()).toEqual({});
	});

	test("should remove absolute path entry", () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey("/usr/src/test2/testified", "bar");

		expect(fileEntryCache.cache.all()).toEqual({
			"/usr/src/test2/testified": "bar",
		});
		fileEntryCache.removeEntry("/usr/src/test2/testified");
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe("removeCacheFile()", () => {
	test("should remove the cache file", () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey("foo", "bar");
		expect(fileEntryCache.cache.all()).toEqual({ foo: "bar" });
		fileEntryCache.reconcile();
		expect(fs.existsSync(fileEntryCache.cache.cacheFilePath)).toBe(true);
		fileEntryCache.deleteCacheFile();
		expect(fs.existsSync(fileEntryCache.cache.cacheFilePath)).toBe(false);
		// Clean up
		fs.rmSync(fileEntryCache.cache.cacheDirPath, {
			recursive: true,
			force: true,
		});
	});
});

describe("getFileDescriptor()", () => {
	const fileCacheName = ".cacheGFD";
	beforeEach(() => {
		// Generate files for testing
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});

	test("should return non-existent file descriptor", () => {
		const fileEntryCache = new FileEntryCache();
		const fileDescriptor =
			fileEntryCache.getFileDescriptor("non-existent-file");
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe("non-existent-file");
		expect(fileDescriptor.err).toBeDefined();
		expect(fileDescriptor.notFound).toBe(true);
		expect(fileDescriptor.meta.data).to.not.toBeDefined();
	});

	test("should save the meta data after the first call and loading data", () => {
		const shared = { shared: "shared" };
		const data = { testingFooVariable: "11", name: "test1.txt", shared };
		const fileEntryCache = new FileEntryCache({ useCheckSum: true });
		const testFile1 = path.resolve("./.cacheGFD/test1.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		fileDescriptor.meta.data = data;
		expect(fileDescriptor).toBeDefined();
		fileEntryCache.reconcile();

		// Add the meta data to the cache
		const fileEntryCache2 = createFromFile(fileEntryCache.cache.cacheFilePath, {
			useCheckSum: true,
		});
		const fileDescriptor2 = fileEntryCache2.getFileDescriptor(testFile1);
		const data2 = { testingFooVariable: "22", name: "test1.txt", shared };
		fileDescriptor2.meta.data = data2;
		fileEntryCache2.reconcile();

		// Load the meta data from the cache
		const fileEntryCache3 = createFromFile(fileEntryCache.cache.cacheFilePath, {
			useCheckSum: true,
		});
		const fileDescriptor3 = fileEntryCache3.getFileDescriptor(testFile1);
		expect(fileDescriptor3).toBeDefined();
		expect(fileDescriptor3.meta.data).toEqual(data2);

		// Verify that the data shows changed
		const fileDescriptor4 = fileEntryCache3.getFileDescriptor(testFile1);
		expect(fileDescriptor4).toBeDefined();
		expect(fileDescriptor4.meta.data).toEqual(data2);
		expect(fileDescriptor4.changed).toEqual(false);
	});

	test("should preserve custom meta properties like meta.results and meta.hashOfConfig", () => {
		const fileEntryCache = new FileEntryCache({ useCheckSum: true });
		const testFile1 = path.resolve("./.cacheGFD/test1.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);

		// Add custom properties directly to meta
		fileDescriptor.meta.results = { errors: 0, warnings: 2 };
		fileDescriptor.meta.hashOfConfig = "abc123def456";
		fileDescriptor.meta.customData = { foo: "bar" };

		expect(fileDescriptor).toBeDefined();
		fileEntryCache.reconcile();

		// Load from cache and verify custom properties are preserved
		const fileEntryCache2 = createFromFile(fileEntryCache.cache.cacheFilePath, {
			useCheckSum: true,
		});
		const fileDescriptor2 = fileEntryCache2.getFileDescriptor(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.meta.results).toEqual({ errors: 0, warnings: 2 });
		expect(fileDescriptor2.meta.hashOfConfig).toEqual("abc123def456");
		expect(fileDescriptor2.meta.customData).toEqual({ foo: "bar" });
		expect(fileDescriptor2.changed).toEqual(false);

		// Update custom properties
		fileDescriptor2.meta.results = { errors: 1, warnings: 0 };
		fileDescriptor2.meta.hashOfConfig = "xyz789ghi012";
		fileEntryCache2.reconcile();

		// Verify updates are preserved
		const fileEntryCache3 = createFromFile(fileEntryCache.cache.cacheFilePath, {
			useCheckSum: true,
		});
		const fileDescriptor3 = fileEntryCache3.getFileDescriptor(testFile1);
		expect(fileDescriptor3.meta.results).toEqual({ errors: 1, warnings: 0 });
		expect(fileDescriptor3.meta.hashOfConfig).toEqual("xyz789ghi012");
		expect(fileDescriptor3.meta.customData).toEqual({ foo: "bar" });
	});

	test("should preserve custom meta properties across file changes", () => {
		const fileEntryCache = new FileEntryCache({ useCheckSum: true });
		const testFile1 = path.resolve("./.cacheGFD/test1.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);

		// Add custom properties
		fileDescriptor.meta.results = { linted: true };
		fileDescriptor.meta.hashOfConfig = "config123";
		fileEntryCache.reconcile();

		// Modify the file
		fs.writeFileSync(testFile1, "modified content");

		// Get descriptor again - file should be marked as changed but custom props preserved
		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor2.changed).toBe(true);
		expect(fileDescriptor2.meta.results).toEqual({ linted: true });
		expect(fileDescriptor2.meta.hashOfConfig).toEqual("config123");

		// Update custom properties after file change
		fileDescriptor2.meta.results = { linted: true, revalidated: true };
		fileEntryCache.reconcile();

		// Verify both file stats and custom properties are updated
		const fileDescriptor3 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor3.changed).toBe(false);
		expect(fileDescriptor3.meta.results).toEqual({
			linted: true,
			revalidated: true,
		});
		expect(fileDescriptor3.meta.hashOfConfig).toEqual("config123");
	});

	test("should return a file descriptor", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheGFD/test1.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.meta).toBeDefined();
		expect(fileDescriptor.meta?.size).toBe(4);
		expect(fileDescriptor.meta?.hash).to.not.toBeDefined();
	});

	test("should return a file descriptor with checksum", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheGFD/test2.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1, {
			useCheckSum: true,
		});
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.meta?.hash).toBeDefined();
	});

	test("should return a file descriptor with global useCheckSum", () => {
		const fileEntryCache = new FileEntryCache({ useCheckSum: true });
		const testFile1 = path.resolve("./.cacheGFD/test2.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.meta?.hash).toBeDefined();
	});

	test("should return a file descriptor with checksum and error", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheGFD/test2.txt");
		fs.chmodSync(testFile1, 0o000);
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1, {
			useCheckSum: true,
		});
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.err).toBeDefined();
		expect(fileDescriptor.notFound).toBe(false);
	});

	test("should return that the file has not changed", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheGFD/test3.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);

		// Reconcile so the file becomes the cached baseline before re-checking
		fileEntryCache.reconcile();

		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(false);
	});

	test("should return that the file has changed", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheGFD/test3.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);

		fs.writeFileSync(testFile1, "test4 changed");
		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		fileEntryCache.cache.get(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(true);
	});

	test("should return that the file has changed", () => {
		const fileEntryCache = new FileEntryCache({ useCheckSum: true });
		const testFile1 = path.resolve("./.cacheGFD/test3.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);
		fs.writeFileSync(testFile1, "testified");
		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(true);
	});

	test("should return that the file has changed via via time or checksum", () => {
		const fileEntryCache = new FileEntryCache({ useCheckSum: true });
		const testFile1 = path.resolve("./.cacheGFD/test1.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);
		// Reconcile so the file becomes the cached baseline before re-checking
		fileEntryCache.reconcile();
		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(false);
		expect(fileEntryCache.cache.get(testFile1)).toEqual(fileDescriptor2.meta);
	});

	test("should work with relative paths", () => {
		const fileEntryCache = new FileEntryCache();
		const fileDescriptor = fileEntryCache.getFileDescriptor(
			"./.cacheGFD/test1.txt",
		);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe("./.cacheGFD/test1.txt");
		expect(fileDescriptor.meta?.size).toBe(4);
		expect(fileDescriptor.changed).toBe(true);
	});

	test("should preserve relative paths as keys", () => {
		const fileEntryCache = new FileEntryCache();
		const fileDescriptor = fileEntryCache.getFileDescriptor(
			".cacheGFD/test1.txt",
		);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(".cacheGFD/test1.txt");
		expect(fileDescriptor.meta?.size).toBe(4);
		expect(fileDescriptor.changed).toBe(true);
	});

	test("should preserve absolute paths as keys", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheGFD/test1.txt");
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);
	});

	test("relative and absolute paths are different keys", () => {
		const fileEntryCache = new FileEntryCache();
		const relPath = "./.cacheGFD/test1.txt";
		const absPath = path.resolve(relPath);

		const fileDescriptor1 = fileEntryCache.getFileDescriptor(relPath);
		expect(fileDescriptor1.key).toBe(relPath);
		expect(fileDescriptor1.changed).toBe(true);

		const fileDescriptor2 = fileEntryCache.getFileDescriptor(absPath);
		expect(fileDescriptor2.key).toBe(absPath);
		expect(fileDescriptor2.changed).toBe(true);

		// Reconcile so both keys become cached baselines
		fileEntryCache.reconcile();

		// Should be cached separately
		const fileDescriptor3 = fileEntryCache.getFileDescriptor(relPath);
		expect(fileDescriptor3.changed).toBe(false);

		const fileDescriptor4 = fileEntryCache.getFileDescriptor(absPath);
		expect(fileDescriptor4.changed).toBe(false);
	});
});

describe("hasFileChanged()", () => {
	const fileCacheName = ".cacheHFC";
	beforeAll(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
	});

	afterAll(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});

	test("should return false for non-existent file", () => {
		const fileEntryCache = new FileEntryCache();
		expect(fileEntryCache.hasFileChanged("non-existent-file")).toBe(false);
	});

	test("should return true for first time file", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheHFC/test1.txt");
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(true);
	});

	test("should return true for changed file", () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve("./.cacheHFC/test1.txt");
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(true);
		// Repeated calls keep reporting the file as changed until it is reconciled
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(true);
		fileEntryCache.reconcile();
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(false);
		fs.writeFileSync(testFile1, "test4");
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(true);
	});
});

describe("normalizeEntries()", () => {
	const fileCacheName = ".cacheNE";
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});
	test("should return an empty array", () => {
		const fileEntryCache = new FileEntryCache();
		const entries = fileEntryCache.normalizeEntries([]);
		expect(entries).toEqual([]);
	});
	test("should return an array of entries", () => {
		const fileEntryCache = new FileEntryCache();
		const file1 = `./${fileCacheName}/test1.txt`;
		const file2 = `./${fileCacheName}/test2.txt`;
		fileEntryCache.getFileDescriptor(file2);
		// Reconcile so file2 becomes a cached baseline (unchanged on re-check)
		fileEntryCache.reconcile();
		const entries = fileEntryCache.normalizeEntries([file1, file2]);
		expect(entries[0].key).toBe(file1);
		expect(entries[0].changed).toBe(true);
		expect(entries[1].key).toBe(file2);
		expect(entries[1].changed).toBe(false);
	});

	test("should return all entries", () => {
		const fileEntryCache = new FileEntryCache({
			useCheckSum: true,
			useAbsolutePathAsKey: false,
		});
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test1.txt`);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test2.txt`);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test3.txt`);
		// Reconcile so the files become cached baselines (unchanged on re-check)
		fileEntryCache.reconcile();
		fs.chmodSync(path.resolve(`./${fileCacheName}/test3.txt`), 0o000);
		const entries = fileEntryCache.normalizeEntries();
		expect(entries.length).toBe(2);
		expect(entries[0].key).toBe(`./${fileCacheName}/test1.txt`);
		expect(entries[0].changed).toBe(false);
		expect(entries[1].key).toBe(`./${fileCacheName}/test2.txt`);
		expect(entries[1].changed).toBe(false);
	});
});

describe("reconcile()", () => {
	const fileCacheName = ".cacheReconcile";
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), "test4");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});

	test("should reconcile the cache", () => {
		const options: FileEntryCacheOptions = {
			cache: {
				cacheId: "test1",
				cacheDir: "./.cacheReconcile",
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		const fileEntry1 = fileEntryCache.getFileDescriptor(
			`./${fileCacheName}/test1.txt`,
		);
		if (fileEntry1.meta) {
			fileEntry1.meta.data = { testingFooVariable: "11" };
		}

		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test2.txt`);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test3.txt`);
		fileEntryCache.reconcile();
		const cacheFileContent = fs.readFileSync(
			fileEntryCache.cache.cacheFilePath,
			"utf8",
		);
		expect(cacheFileContent).toContain("test2.txt");
		expect(cacheFileContent).toContain("test3.txt");
		expect(cacheFileContent).toContain('"testingFooVariable"');
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});

	test("should reconcile with deleted files", () => {
		const options: FileEntryCacheOptions = {
			cache: {
				cacheId: "test1",
				cacheDir: "./.cacheReconcile",
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test1.txt`);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test2.txt`);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test3.txt`);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test4.txt`);
		const testFile4 = path.resolve(`./${fileCacheName}/test4.txt`);
		fs.unlinkSync(testFile4);

		fileEntryCache.reconcile();

		const cacheFileContent = fs.readFileSync(
			fileEntryCache.cache.cacheFilePath,
			"utf8",
		);
		expect(cacheFileContent).toContain("test1.txt");
		expect(cacheFileContent).toContain("test2.txt");
		expect(cacheFileContent).toContain("test3.txt");
		expect(cacheFileContent).not.toContain("test4.txt");
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});
});

describe("analyzeFiles()", () => {
	const fileCacheName = "analyzeFiles";
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), "test4");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
		fs.rmSync(path.resolve("./.cacheAnalyzeFiles"), {
			recursive: true,
			force: true,
		});
	});

	test("should analyze files", () => {
		const options: FileEntryCacheOptions = {
			cache: {
				cacheId: "test1",
				cacheDir: "./.cacheAnalyzeFiles",
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		const files = [
			`./${fileCacheName}/test1.txt`,
			`./${fileCacheName}/test2.txt`,
			`./${fileCacheName}/test3.txt`,
			`./${fileCacheName}/test4.txt`,
		];
		const analyzedFiles = fileEntryCache.analyzeFiles(files);
		expect(analyzedFiles).toBeDefined();
		expect(analyzedFiles.changedFiles.length).toBe(4);
	});

	test("should analyze files with removed ones", () => {
		const options: FileEntryCacheOptions = {
			cache: {
				cacheId: "test1",
				cacheDir: "./.cacheAnalyzeFiles",
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		const files = [
			`./${fileCacheName}/test1.txt`,
			`./${fileCacheName}/test2.txt`,
			`./${fileCacheName}/test3.txt`,
			`./${fileCacheName}/test4.txt`,
		];
		const analyzedFiles = fileEntryCache.analyzeFiles(files);
		expect(analyzedFiles).toBeDefined();
		expect(analyzedFiles.changedFiles.length).toBe(4);
		// Reconcile so the files become cached baselines (unchanged on re-check)
		fileEntryCache.reconcile();
		const testFile4 = path.resolve(`./${fileCacheName}/test4.txt`);
		fs.unlinkSync(testFile4);
		const analyzedFiles2 = fileEntryCache.analyzeFiles(files);
		expect(analyzedFiles2.changedFiles.length).toBe(0);
		expect(analyzedFiles2.notChangedFiles.length).toBe(3);
		expect(analyzedFiles2.notFoundFiles.length).toBe(1);
	});
});

describe("getUpdatedFiles()", () => {
	const fileCacheName = "getUpdatedFiles";
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), "test4");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});

	test("should return empty array on get updated files", () => {
		const fileEntryCache = new FileEntryCache({
			useAbsolutePathAsKey: false,
		});
		const files = [
			`./${fileCacheName}/test1.txt`,
			`./${fileCacheName}/test2.txt`,
			`./${fileCacheName}/test3.txt`,
			`./${fileCacheName}/test4.txt`,
		];
		const updatedFiles = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles).toEqual(files);
		// Reconcile so the files become cached baselines (no longer updated)
		fileEntryCache.reconcile();
		const updatedFiles2 = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles2).toEqual([]);
	});

	test("should return updated files if one is updated", () => {
		const fileEntryCache = new FileEntryCache({
			useAbsolutePathAsKey: false,
		});
		const files = [
			`./${fileCacheName}/test1.txt`,
			`./${fileCacheName}/test2.txt`,
			`./${fileCacheName}/test3.txt`,
			`./${fileCacheName}/test4.txt`,
		];
		const updatedFiles = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles).toEqual(files);
		// Reconcile so the files become cached baselines before modifying one
		fileEntryCache.reconcile();
		const testFile4 = path.resolve(`./${fileCacheName}/test4.txt`);
		fs.writeFileSync(testFile4, "test5booosdkfjsldfkjsldkjfls");
		const updatedFiles2 = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles2).toEqual([`./${fileCacheName}/test4.txt`]);
	});
});

describe("createFromFile()", () => {
	const fileCacheName = "createFromFiles";
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), "test4");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});
	test("should create a file entry cache from a file", () => {
		const filePath = path.resolve("./.testCacheCFF/test1");
		const cacheId = path.basename(filePath);
		const cacheDirectory = path.dirname(filePath);
		const fileEntryCacheOptions = {
			cache: {
				cacheId,
				cacheDir: cacheDirectory,
			},
		};
		const fileEntryCache1 = new FileEntryCache(fileEntryCacheOptions);
		fileEntryCache1.getFileDescriptor(`./${fileCacheName}/test1.txt`);
		fileEntryCache1.getFileDescriptor(`./${fileCacheName}/test2.txt`);
		fileEntryCache1.getFileDescriptor(`./${fileCacheName}/test3.txt`);
		fileEntryCache1.getFileDescriptor(`./${fileCacheName}/test4.txt`);
		fileEntryCache1.reconcile();
		const fileEntryCache2 = defaultFileEntryCache.createFromFile(
			filePath,
			undefined,
		);
		expect(fileEntryCache2.cache.cacheId).toBe(cacheId);
		expect(fileEntryCache2.cache.cacheDir).toBe(cacheDirectory);
		expect(fileEntryCache2.cache.all()).toEqual(fileEntryCache1.cache.all());
		fs.rmSync(path.resolve(cacheDirectory), { recursive: true, force: true });
	});
	test("should detect if a file has changed prior to creating a file entry cache from a file", () => {
		const filePath = path.resolve("./.testCacheCFF/test1");
		const cacheId = path.basename(filePath);
		const cacheDirectory = path.dirname(filePath);
		const fileEntryCacheOptions = {
			cache: {
				cacheId,
				cacheDir: cacheDirectory,
			},
		};
		const fileEntryCache1 = new FileEntryCache(fileEntryCacheOptions);
		const testFile = `./${fileCacheName}/test1.txt`;
		fileEntryCache1.getFileDescriptor(testFile);
		fileEntryCache1.reconcile();

		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "modified");

		const fileEntryCache2 = defaultFileEntryCache.createFromFile(
			filePath,
			undefined,
		);
		expect(fileEntryCache2.getUpdatedFiles([testFile]).length).toBe(1);
		fileEntryCache2.reconcile();

		const fileEntryCache3 = defaultFileEntryCache.createFromFile(
			filePath,
			undefined,
		);
		expect(fileEntryCache3.getUpdatedFiles([testFile]).length).toBe(0);
		fs.rmSync(path.resolve(cacheDirectory), { recursive: true, force: true });
	});
});

describe("getFileDescriptorsByPath()", () => {
	const fileCacheName = "filesGFDBP";
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), "test4");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});
	test("should return an empty array", () => {
		const fileEntryCache = new FileEntryCache();
		const fileDescriptors = fileEntryCache.getFileDescriptorsByPath("/foo/bar");
		expect(fileDescriptors).toEqual([]);
	});

	test("should return an array of file descriptors", () => {
		const fileEntryCache = new FileEntryCache({
			useAbsolutePathAsKey: false,
		});
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test1.txt`);
		fileEntryCache.getFileDescriptor(`./${fileCacheName}/test2.txt`);
		const fileDescriptors = fileEntryCache.getFileDescriptorsByPath(
			`./${fileCacheName}`,
		);
		expect(fileDescriptors.length).toBe(2);
		expect(fileDescriptors[0].key).toBe(`./${fileCacheName}/test1.txt`);
		expect(fileDescriptors[1].key).toBe(`./${fileCacheName}/test2.txt`);
	});
});

describe("renameCacheKeys()", () => {
	const fileCacheName = "filesRAPK";
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), "test4");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
	});

	test("should handle rename of cache keys", () => {
		const fileEntryCache = new FileEntryCache();
		const file1 = path.resolve(`./${fileCacheName}/test1.txt`);
		const file2 = path.resolve(`./${fileCacheName}/test2.txt`);
		const file3 = path.resolve(`./${fileCacheName}/test3.txt`);
		fileEntryCache.getFileDescriptor(file1);
		fileEntryCache.getFileDescriptor(file2);
		fileEntryCache.getFileDescriptor(file3);
		const keys = fileEntryCache.cache.keys();
		expect(keys.length).toBe(3);
		expect(keys).toContain(file1);
		expect(keys).toContain(file2);
		expect(keys).toContain(file3);
		const oldFileCacheNamePath = path.resolve(`./${fileCacheName}`);
		const newFileCacheNamePath = path.resolve(`${fileCacheName}-new`);
		fileEntryCache.renameCacheKeys(oldFileCacheNamePath, newFileCacheNamePath);
		const newKeys = fileEntryCache.cache.keys();
		expect(newKeys.length).toBe(3);
		expect(newKeys).toContain(`${newFileCacheNamePath}/test1.txt`);
		expect(newKeys).toContain(`${newFileCacheNamePath}/test2.txt`);
		expect(newKeys).toContain(`${newFileCacheNamePath}/test3.txt`);
	});

	test("should handle rename of cache keys with reconcile", () => {
		const fileEntryCache = new FileEntryCache();
		const file1 = path.resolve(`./${fileCacheName}/test1.txt`);
		const file2 = path.resolve(`./${fileCacheName}/test2.txt`);
		const file3 = path.resolve(`./${fileCacheName}/test3.txt`);
		fileEntryCache.getFileDescriptor(file1);
		fileEntryCache.getFileDescriptor(file2);
		fileEntryCache.getFileDescriptor(file3);
		const keys = fileEntryCache.cache.keys();
		expect(keys.length).toBe(3);
		expect(keys).toContain(file1);
		expect(keys).toContain(file2);
		expect(keys).toContain(file3);
		const oldFileCacheNamePath = path.resolve(`./${fileCacheName}`);
		const newFileCacheNamePath = path.resolve(`${fileCacheName}-new`);
		fs.renameSync(oldFileCacheNamePath, newFileCacheNamePath);
		fileEntryCache.renameCacheKeys(oldFileCacheNamePath, newFileCacheNamePath);
		const newKeys = fileEntryCache.cache.keys();
		expect(newKeys.length).toBe(3);
		expect(newKeys).toContain(`${newFileCacheNamePath}/test1.txt`);
		expect(newKeys).toContain(`${newFileCacheNamePath}/test2.txt`);
		expect(newKeys).toContain(`${newFileCacheNamePath}/test3.txt`);
		fileEntryCache.reconcile();
		// Should show not changed as it is just a folder rename
		const fileEntry1 = fileEntryCache.getFileDescriptor(
			`${newFileCacheNamePath}/test1.txt`,
		);
		expect(fileEntry1.changed).toBe(false);

		const fileEntry2 = fileEntryCache.getFileDescriptor(
			`${newFileCacheNamePath}/test2.txt`,
		);
		expect(fileEntry2.changed).toBe(false);

		fs.rmSync(newFileCacheNamePath, { recursive: true, force: true });
		fs.rmSync(fileEntryCache.cache.cacheDirPath, {
			recursive: true,
			force: true,
		});
	});
});

/**
 * Regression tests for https://github.com/jaredwray/cacheable/issues/1648
 *
 * These cover three behaviors that differed from file-entry-cache v8 and that
 * ESLint relies on:
 *   1. reconcile() must only update cache entries for files that were inspected
 *      via getFileDescriptor(), not every entry tracked in the cache.
 *   2. getFileDescriptor() must keep reporting `changed: true` on repeated calls
 *      for the same file until the cache is reconciled.
 *   3. create() must not throw when the cache file content is invalid; it should
 *      start fresh and overwrite the file on the next reconcile().
 */
describe("issue #1648", () => {
	const fileCacheName = "issue-1648-files";
	const cacheDir = ".cache-issue-1648";
	const cacheId = ".cache";

	beforeEach(() => {
		fs.mkdirSync(path.resolve(`./${fileCacheName}`), { recursive: true });
		fs.writeFileSync(path.resolve(`./${fileCacheName}/a.txt`), "a");
		fs.writeFileSync(path.resolve(`./${fileCacheName}/b.txt`), "b");
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
		fs.rmSync(path.resolve(`./${cacheDir}`), { recursive: true, force: true });
	});

	test("1. reconcile() only updates files that were inspected this run", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const fileB = path.resolve(`./${fileCacheName}/b.txt`);

		// Run 1: inspect both files and persist them.
		const run1 = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(run1.getFileDescriptor(fileA).changed).toBe(true);
		expect(run1.getFileDescriptor(fileB).changed).toBe(true);
		run1.reconcile();

		// Run 2: only file A is inspected. File B changes on disk in the meantime
		// but is NOT inspected, so reconcile() must not revalidate it.
		const run2 = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(run2.getFileDescriptor(fileA).changed).toBe(false);
		fs.writeFileSync(fileB, "b changed");
		run2.reconcile();

		// Run 3: file B must still be reported as changed because it was never
		// inspected (and therefore never revalidated) during run 2.
		const run3 = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(run3.getFileDescriptor(fileB).changed).toBe(true);
	});

	test("reconcile() prunes deleted files even when not inspected this run (v8 removeNotFoundFiles parity)", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const fileB = path.resolve(`./${fileCacheName}/b.txt`);

		// Run 1: inspect and persist both files.
		const run1 = defaultFileEntryCache.create(cacheId, cacheDir);
		run1.getFileDescriptor(fileA);
		run1.getFileDescriptor(fileB);
		run1.reconcile();

		// Run 2: delete B on disk and inspect ONLY A. B is never inspected this
		// run, but reconcile() must still prune its entry because the file is gone
		// (otherwise stale entries for deleted files accumulate forever).
		const run2 = defaultFileEntryCache.create(cacheId, cacheDir);
		run2.getFileDescriptor(fileA);
		fs.unlinkSync(fileB);
		run2.reconcile();
		expect(run2.cache.keys()).not.toContain(run2.createFileKey(fileB));

		// Run 3: the prune is persisted to disk.
		const run3 = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(run3.cache.keys()).not.toContain(run3.createFileKey(fileB));
	});

	test("2. getFileDescriptor() keeps reporting changed until reconcile", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = defaultFileEntryCache.create(cacheId, cacheDir);

		// A brand new file is changed, and stays changed on subsequent calls.
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);

		// Once reconciled, it is considered unchanged.
		cache.reconcile();
		expect(cache.getFileDescriptor(fileA).changed).toBe(false);

		// After a modification it reports changed again, and keeps doing so until
		// the next reconcile.
		fs.writeFileSync(fileA, "a modified");
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
	});

	test("2b. getFileDescriptor() keeps reporting changed with useCheckSum", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = defaultFileEntryCache.create(cacheId, cacheDir, {
			useCheckSum: true,
		});

		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);

		cache.reconcile();
		expect(cache.getFileDescriptor(fileA).changed).toBe(false);
	});

	test("3. create() does not throw on invalid cache file content", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cachePath = path.resolve(`./${cacheDir}/${cacheId}`);

		// Write a cache file with invalid (non-parseable) content.
		fs.mkdirSync(path.resolve(`./${cacheDir}`), { recursive: true });
		fs.writeFileSync(cachePath, "this is not valid json {{{");

		// create() should silently start fresh instead of throwing.
		let cache!: ReturnType<typeof defaultFileEntryCache.create>;
		expect(() => {
			cache = defaultFileEntryCache.create(cacheId, cacheDir);
		}).not.toThrow();

		// The cache works and the corrupt file is overwritten on reconcile.
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
		cache.reconcile();

		const reloaded = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(reloaded.getFileDescriptor(fileA).changed).toBe(false);
	});

	test("reconcile() skips visited entries removed from the underlying cache", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = defaultFileEntryCache.create(cacheId, cacheDir);

		// Visit the file so it is tracked as a session baseline.
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);

		// Remove the entry directly from the underlying flat-cache, so the session
		// baseline references a key that no longer exists in the cache.
		cache.cache.removeKey(cache.createFileKey(fileA));

		// reconcile() must skip the now-missing entry instead of throwing.
		expect(() => cache.reconcile()).not.toThrow();
		expect(cache.cache.keys()).not.toContain(cache.createFileKey(fileA));
	});

	test("3b. createFromFile() does not throw on invalid cache file content", () => {
		const cachePath = path.resolve(`./${cacheDir}/${cacheId}`);
		fs.mkdirSync(path.resolve(`./${cacheDir}`), { recursive: true });
		fs.writeFileSync(cachePath, "@@ not json @@");

		expect(() => defaultFileEntryCache.createFromFile(cachePath)).not.toThrow();
	});

	test("3c. create() rethrows unexpected (non-parse) load errors", () => {
		// A directory at the cache path causes a read (EISDIR) error rather than a
		// parse error. This must propagate instead of silently discarding data.
		const cachePath = path.resolve(`./${cacheDir}/${cacheId}`);
		fs.mkdirSync(cachePath, { recursive: true });

		expect(() => defaultFileEntryCache.create(cacheId, cacheDir)).toThrow();
	});

	test("3d. create() does not throw on valid-JSON-but-non-array cache content", () => {
		// A leftover/foreign cache file that is valid JSON but NOT the flatted
		// array the parser expects (e.g. an ancient plain-object cache or a
		// hand/3rd-party-written file). flatted.parse throws a TypeError here
		// rather than a SyntaxError; create() must still recover by starting fresh.
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cachePath = path.resolve(`./${cacheDir}/${cacheId}`);

		fs.mkdirSync(path.resolve(`./${cacheDir}`), { recursive: true });
		fs.writeFileSync(cachePath, '{"/some/old/path.js":{"size":1,"mtime":2}}');

		let cache!: ReturnType<typeof defaultFileEntryCache.create>;
		expect(() => {
			cache = defaultFileEntryCache.create(cacheId, cacheDir);
		}).not.toThrow();

		// The cache works and the unparseable file is overwritten on reconcile.
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
		cache.reconcile();

		const reloaded = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(reloaded.getFileDescriptor(fileA).changed).toBe(false);
	});

	test("reconcile() keeps a cached entry when statSync fails with a non-ENOENT error", () => {
		// A transient stat failure (e.g. EACCES) for a still-present file must NOT
		// drop the entry the way an ENOENT (deleted file) does — that would lose
		// valid cached data and force a spurious re-process.
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = defaultFileEntryCache.create(cacheId, cacheDir);
		const key = cache.createFileKey(fileA);

		expect(cache.getFileDescriptor(fileA).changed).toBe(true);

		const spy = vi.spyOn(fs, "statSync").mockImplementation(() => {
			const error = new Error(
				"EACCES: permission denied",
			) as NodeJS.ErrnoException;
			error.code = "EACCES";
			throw error;
		});
		try {
			expect(() => cache.reconcile()).not.toThrow();
		} finally {
			spy.mockRestore();
		}

		// Entry survived in memory and on disk.
		expect(cache.cache.keys()).toContain(key);
		const reloaded = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(reloaded.getFileDescriptor(fileA).changed).toBe(false);
	});

	test("reconcile() logs (and keeps) on a non-ENOENT stat error when a logger is set", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const errors: string[] = [];
		const logger = {
			level: "error",
			trace: () => {},
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: (data: string | object, ...args: unknown[]) => {
				errors.push(typeof data === "string" ? data : (args[0] as string));
			},
			fatal: () => {},
		};
		const cache = defaultFileEntryCache.create(cacheId, cacheDir, { logger });
		const key = cache.createFileKey(fileA);

		expect(cache.getFileDescriptor(fileA).changed).toBe(true);

		const spy = vi.spyOn(fs, "statSync").mockImplementation(() => {
			const error = new Error("EIO: i/o error") as NodeJS.ErrnoException;
			error.code = "EIO";
			throw error;
		});
		try {
			cache.reconcile();
		} finally {
			spy.mockRestore();
		}

		expect(cache.cache.keys()).toContain(key);
		expect(
			errors.some((m) => m.includes("reconcile: unable to stat file")),
		).toBe(true);
	});

	test("a file modified between getFileDescriptor and reconcile is detected next run", () => {
		// Regression for reconcile() refreshing size/mtime: the cached entry must
		// reflect the content that was actually inspected, not a later edit. With
		// useModifiedTime (no checksum), refreshing size/mtime at reconcile time
		// would mask a change made after the file was inspected.
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = defaultFileEntryCache.create(cacheId, cacheDir);

		expect(cache.getFileDescriptor(fileA).changed).toBe(true);

		// Modify the file after inspecting it but before reconciling.
		fs.writeFileSync(fileA, "a much longer content than before");
		cache.reconcile();

		// The next run must still see the file as changed, because the cached
		// entry corresponds to the previously-inspected (shorter) content.
		const next = defaultFileEntryCache.create(cacheId, cacheDir);
		expect(next.getFileDescriptor(fileA).changed).toBe(true);
	});
});
