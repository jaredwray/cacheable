import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fileEntryCache, { FileEntryCache } from "../src/index.js";

describe("cwd functionality", () => {
	const testBaseDir = path.resolve(process.cwd(), "../test-cwd-base");
	const cacheDirectory = path.resolve(__dirname, "cache-cwd");
	const srcDir = path.join(testBaseDir, "src");
	const libDir = path.join(testBaseDir, "lib");
	const testFile1 = path.join(srcDir, "index.js");
	const testFile2 = path.join(libDir, "utils.js");

	beforeEach(() => {
		// Create test directory structure
		fs.mkdirSync(srcDir, { recursive: true });
		fs.mkdirSync(libDir, { recursive: true });
		fs.writeFileSync(testFile1, "export const main = () => {};\n"); // 30 bytes
		fs.writeFileSync(testFile2, "export const util = () => {};\n"); // 30 bytes
	});

	afterEach(() => {
		// Clean up
		if (fs.existsSync(cacheDirectory)) {
			fs.rmSync(cacheDirectory, { recursive: true, force: true });
		}
		if (fs.existsSync(testBaseDir)) {
			fs.rmSync(testBaseDir, { recursive: true, force: true });
		}
	});

	test("should set cwd via constructor", () => {
		const cache = new FileEntryCache({
			cwd: testBaseDir,
			cache: {
				cacheId: ".testcache",
				cacheDir: cacheDirectory,
			},
		});

		expect(cache.cwd).toBe(testBaseDir);
	});

	test("should set cwd via create function", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		expect(cache.cwd).toBe(testBaseDir);
	});

	test("should use cwd for relative path resolution", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		// Get file descriptor using relative path
		const descriptor = cache.getFileDescriptor("src/index.js");

		expect(descriptor).toBeDefined();
		expect(descriptor.key).toBe("src/index.js");
		expect(descriptor.changed).toBe(true);
		expect(descriptor.notFound).toBeUndefined();
		expect(descriptor.meta?.size).toBe(30); // 'export const main = () => {};\n'
	});

	test("should allow changing cwd via setter", () => {
		const cache = fileEntryCache.create(".testcache", cacheDirectory, true);

		// Initially uses process.cwd()
		expect(cache.cwd).toBe(process.cwd());

		// Change the working directory
		cache.cwd = testBaseDir;
		expect(cache.cwd).toBe(testBaseDir);

		// Now it should find files relative to testBaseDir
		const descriptor = cache.getFileDescriptor("src/index.js");
		expect(descriptor.notFound).toBeUndefined();
		expect(descriptor.meta?.size).toBe(30);
	});

	test("should work with reconcile() using class-level cwd", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		// Get descriptors for both files
		const descriptor1 = cache.getFileDescriptor("src/index.js");
		const descriptor2 = cache.getFileDescriptor("lib/utils.js");

		expect(descriptor1.changed).toBe(true);
		expect(descriptor2.changed).toBe(true);

		// Add metadata
		if (descriptor1.meta) {
			descriptor1.meta.data = { type: "source" };
		}
		if (descriptor2.meta) {
			descriptor2.meta.data = { type: "library" };
		}

		// Reconcile should work correctly with the class-level cwd
		cache.reconcile();

		// Create new cache instance with same cwd
		const cache2 = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		// Files should be cached
		const cached1 = cache2.getFileDescriptor("src/index.js");
		const cached2 = cache2.getFileDescriptor("lib/utils.js");

		expect(cached1.changed).toBe(false);
		expect(cached1.meta?.data).toStrictEqual({ type: "source" });
		expect(cached2.changed).toBe(false);
		expect(cached2.meta?.data).toStrictEqual({ type: "library" });
	});

	test("should handle nested relative paths with cwd", () => {
		const nestedDir = path.join(srcDir, "components");
		fs.mkdirSync(nestedDir, { recursive: true });
		const nestedFile = path.join(nestedDir, "Button.js");
		fs.writeFileSync(nestedFile, "export const Button = () => {};\n"); // 32 bytes

		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		const descriptor = cache.getFileDescriptor("src/components/Button.js");

		expect(descriptor.notFound).toBeUndefined();
		expect(descriptor.changed).toBe(true);
		expect(descriptor.meta?.size).toBe(32);
	});

	test("should handle parent directory references with cwd when strictPaths is disabled", () => {
		const childDir = path.join(testBaseDir, "child");
		fs.mkdirSync(childDir, { recursive: true });

		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			childDir, // Set cwd to child directory
		);

		// Explicitly disable strictPaths to allow parent directory access
		cache.strictPaths = false;

		// Access parent directory file
		const descriptor = cache.getFileDescriptor("../src/index.js");

		expect(descriptor.notFound).toBeUndefined();
		expect(descriptor.changed).toBe(true);
		expect(descriptor.meta?.size).toBe(30);
	});

	test("should handle absolute paths regardless of cwd", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			"/some/other/directory",
		);

		// Use absolute path
		const descriptor = cache.getFileDescriptor(testFile1);

		expect(descriptor.key).toBe(testFile1);
		expect(descriptor.notFound).toBeUndefined();
		expect(descriptor.changed).toBe(true);
		expect(descriptor.meta?.size).toBe(30);
	});

	test("should persist cache across instances with same cwd", () => {
		// First cache instance
		const cache1 = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		const descriptor = cache1.getFileDescriptor("src/index.js");
		if (descriptor.meta) {
			descriptor.meta.data = {
				linted: true,
				errors: 0,
				warnings: 0,
			};
		}

		cache1.reconcile();

		// Second cache instance with same cwd
		const cache2 = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		const cached = cache2.getFileDescriptor("src/index.js");
		expect(cached.changed).toBe(false);
		expect(cached.meta?.data).toStrictEqual({
			linted: true,
			errors: 0,
			warnings: 0,
		});

		// Third cache instance with different cwd should not find the file
		const cache3 = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			process.cwd(), // Different cwd
		);

		const notFound = cache3.getFileDescriptor("src/index.js");
		expect(notFound.notFound).toBe(true);
	});

	test("should detect file changes with cwd", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		// First check
		const descriptor1 = cache.getFileDescriptor("src/index.js");
		expect(descriptor1.changed).toBe(true);

		if (descriptor1.meta) {
			descriptor1.meta.data = { version: 1 };
		}

		cache.reconcile();

		// Modify the file
		fs.writeFileSync(
			testFile1,
			'export const main = () => { return "modified"; };\n',
		);

		// Create new cache instance
		const cache2 = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		const descriptor2 = cache2.getFileDescriptor("src/index.js");
		expect(descriptor2.changed).toBe(true); // File content changed

		// Previous metadata should still be available
		expect(descriptor2.meta?.data).toStrictEqual({ version: 1 });
	});

	test("should handle multiple files with different relative paths", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		const files = ["src/index.js", "lib/utils.js"];

		// Get all descriptors
		const descriptors = files.map((file) => {
			const desc = cache.getFileDescriptor(file);
			if (desc.meta) {
				desc.meta.data = { path: file };
			}
			return desc;
		});

		// All should be marked as changed (first time)
		descriptors.forEach((desc) => {
			expect(desc.changed).toBe(true);
			expect(desc.notFound).toBeUndefined();
		});

		cache.reconcile();

		// Create new instance and verify
		const cache2 = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		files.forEach((file) => {
			const desc = cache2.getFileDescriptor(file);
			expect(desc.changed).toBe(false);
			expect(desc.meta?.data).toStrictEqual({ path: file });
		});
	});

	test("should correctly resolve paths with getAbsolutePath", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			testBaseDir,
		);

		// Test relative path
		const absPath1 = cache.getAbsolutePath("src/index.js");
		expect(absPath1).toBe(path.join(testBaseDir, "src/index.js"));

		// Test absolute path
		const absPath2 = cache.getAbsolutePath("/absolute/path/file.js");
		expect(absPath2).toBe("/absolute/path/file.js");

		// Test parent directory reference (with strictPaths disabled)
		const childCache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			true,
			path.join(testBaseDir, "child"),
		);

		// Disable strictPaths to allow parent directory access
		childCache.strictPaths = false;

		const absPath3 = childCache.getAbsolutePath("../src/index.js");
		expect(absPath3).toBe(path.join(testBaseDir, "src/index.js"));
	});

	test("should handle empty cache with cwd", () => {
		const cache = fileEntryCache.create(
			".testcache",
			cacheDirectory,
			false, // No checksum
			testBaseDir,
		);

		// Get descriptor for non-existent file
		const descriptor = cache.getFileDescriptor("non-existent.js");

		expect(descriptor.notFound).toBe(true);
		expect(descriptor.err).toBeDefined();
		expect(descriptor.err?.message).toContain("ENOENT");

		// Reconcile should handle non-existent files
		cache.reconcile();

		// Cache should still work after reconcile
		const validDescriptor = cache.getFileDescriptor("src/index.js");
		expect(validDescriptor.notFound).toBeUndefined();
		expect(validDescriptor.changed).toBe(true);
	});

	test("deprecated getAbsolutePathWithCwd should still work", () => {
		const cache = fileEntryCache.create(".testcache", cacheDirectory, true);

		// Use deprecated method
		const absPath = cache.getAbsolutePathWithCwd("src/index.js", testBaseDir);
		expect(absPath).toBe(path.join(testBaseDir, "src/index.js"));

		// Should work with absolute paths
		const absPath2 = cache.getAbsolutePathWithCwd(
			"/absolute/path.js",
			testBaseDir,
		);
		expect(absPath2).toBe("/absolute/path.js");
	});

	test("should work with ESLint-like usage pattern", () => {
		// Simulating ESLint's usage pattern with a specific project root
		const projectRoot = testBaseDir;
		const cache = fileEntryCache.create(
			".eslintcache",
			path.join(projectRoot, ".cache"),
			true,
			projectRoot,
		);

		// Process multiple files as ESLint would
		const filesToLint = ["src/index.js", "lib/utils.js"];
		const lintResults = new Map();

		filesToLint.forEach((file) => {
			const descriptor = cache.getFileDescriptor(file);

			if (descriptor.changed) {
				// Simulate linting
				const results = {
					filePath: file,
					messages: [],
					errorCount: 0,
					warningCount: 0,
				};

				lintResults.set(file, results);

				// Store results in cache
				if (descriptor.meta) {
					descriptor.meta.data = results;
				}
			} else {
				// Use cached results
				lintResults.set(file, descriptor.meta?.data);
			}
		});

		// Save cache
		cache.reconcile();

		// Simulate next run
		const cache2 = fileEntryCache.create(
			".eslintcache",
			path.join(projectRoot, ".cache"),
			true,
			projectRoot,
		);

		filesToLint.forEach((file) => {
			const descriptor = cache2.getFileDescriptor(file);
			expect(descriptor.changed).toBe(false);
			expect(descriptor.meta?.data).toBeDefined();
			const data = descriptor.meta?.data as { filePath: string };
			expect(data.filePath).toBe(file);
		});
	});
});
