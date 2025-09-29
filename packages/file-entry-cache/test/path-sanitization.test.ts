import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { FileEntryCache } from "../src/index.js";

describe("path sanitization with strictPaths", () => {
	const testBaseDir = path.resolve(process.cwd(), "../test-sanitize-base");
	const safeDir = path.join(testBaseDir, "safe");
	const cacheDir = path.resolve(__dirname, "cache-sanitize");

	beforeEach(() => {
		// Create test directories
		fs.mkdirSync(safeDir, { recursive: true });
		fs.writeFileSync(path.join(safeDir, "allowed.js"), "// safe file");

		// Create a sensitive file outside the safe directory
		fs.writeFileSync(path.join(testBaseDir, "sensitive.txt"), "sensitive data");
	});

	afterEach(() => {
		// Clean up
		if (fs.existsSync(cacheDir)) {
			fs.rmSync(cacheDir, { recursive: true, force: true });
		}
		if (fs.existsSync(testBaseDir)) {
			fs.rmSync(testBaseDir, { recursive: true, force: true });
		}
	});

	test("should allow access within cwd when strictPaths is false (default)", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: false, // default
		});

		// Should allow access to parent directories
		const parentPath = cache.getAbsolutePath("../sensitive.txt");
		expect(parentPath).toBe(
			path.normalize(path.join(testBaseDir, "sensitive.txt")),
		);

		// Should work normally for files within cwd
		const safePath = cache.getAbsolutePath("allowed.js");
		expect(safePath).toBe(path.normalize(path.join(safeDir, "allowed.js")));
	});

	test("should block path traversal when strictPaths is true", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		// Should throw for parent directory access
		expect(() => cache.getAbsolutePath("../sensitive.txt")).toThrowError(
			/Path traversal attempt blocked/,
		);

		// Should throw for absolute path traversal attempts
		expect(() => cache.getAbsolutePath("../../sensitive.txt")).toThrowError(
			/Path traversal attempt blocked/,
		);

		// Multiple parent directory traversals
		expect(() => cache.getAbsolutePath("../../../etc/passwd")).toThrowError(
			/Path traversal attempt blocked/,
		);
	});

	test("should allow access within cwd when strictPaths is true", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		// Should allow files in the current directory
		const safePath = cache.getAbsolutePath("allowed.js");
		expect(safePath).toBe(path.normalize(path.join(safeDir, "allowed.js")));

		// Should allow subdirectories
		const subDir = cache.getAbsolutePath("./subdir/file.js");
		expect(subDir).toBe(path.normalize(path.join(safeDir, "subdir/file.js")));
	});

	test("should handle absolute paths regardless of strictPaths", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		// Absolute paths bypass the check as they don't use cwd
		const absolutePath = "/absolute/path/file.txt";
		expect(cache.getAbsolutePath(absolutePath)).toBe(absolutePath);
	});

	test("should sanitize null bytes from paths", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: false,
		});

		// Null bytes should be removed
		const pathWithNull = "file\0.js";
		const sanitized = cache.getAbsolutePath(pathWithNull);
		expect(sanitized).toBe(path.normalize(path.join(safeDir, "file.js")));
	});

	test("should work with getAbsolutePathWithCwd and strictPaths", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		const customCwd = path.join(testBaseDir, "custom");
		fs.mkdirSync(customCwd, { recursive: true });

		// Should block traversal outside custom cwd
		expect(() =>
			cache.getAbsolutePathWithCwd("../sensitive.txt", customCwd),
		).toThrowError(/Path traversal attempt blocked/);

		// Should allow within custom cwd
		const safePath = cache.getAbsolutePathWithCwd("file.js", customCwd);
		expect(safePath).toBe(path.normalize(path.join(customCwd, "file.js")));
	});

	test("should handle complex traversal patterns", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		// Mixed traversal patterns
		expect(() => cache.getAbsolutePath("./../sensitive.txt")).toThrowError(
			/Path traversal attempt blocked/,
		);

		expect(() =>
			cache.getAbsolutePath("subdir/../../sensitive.txt"),
		).toThrowError(/Path traversal attempt blocked/);

		// Should allow legitimate same-directory reference
		const sameDirPath = cache.getAbsolutePath("./allowed.js");
		expect(sameDirPath).toBe(path.normalize(path.join(safeDir, "allowed.js")));
	});

	test("should handle edge cases correctly", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		// Empty string
		const emptyPath = cache.getAbsolutePath("");
		expect(emptyPath).toBe(path.normalize(safeDir));

		// Just dot
		const dotPath = cache.getAbsolutePath(".");
		expect(dotPath).toBe(path.normalize(safeDir));

		// Current directory reference
		const currentDir = cache.getAbsolutePath("./");
		expect(currentDir).toBe(path.normalize(safeDir));
	});

	test("should allow toggling strictPaths via setter", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: false,
		});

		// Check initial value via getter
		expect(cache.strictPaths).toBe(false);

		// Initially allows traversal
		const parentPath1 = cache.getAbsolutePath("../sensitive.txt");
		expect(parentPath1).toBe(
			path.normalize(path.join(testBaseDir, "sensitive.txt")),
		);

		// Enable strict mode
		cache.strictPaths = true;
		expect(cache.strictPaths).toBe(true);

		// Now blocks traversal
		expect(() => cache.getAbsolutePath("../sensitive.txt")).toThrowError(
			/Path traversal attempt blocked/,
		);

		// Disable strict mode again
		cache.strictPaths = false;
		expect(cache.strictPaths).toBe(false);

		// Allows traversal again
		const parentPath2 = cache.getAbsolutePath("../sensitive.txt");
		expect(parentPath2).toBe(
			path.normalize(path.join(testBaseDir, "sensitive.txt")),
		);
	});

	test("should properly validate paths at cwd boundary", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		// Path that resolves exactly to cwd should be allowed
		const cwdPath = cache.getAbsolutePath(".");
		expect(cwdPath).toBe(path.normalize(safeDir));

		// Path that goes up and back down to cwd should be allowed
		fs.mkdirSync(path.join(safeDir, "subdir"), { recursive: true });
		const upAndDown = cache.getAbsolutePath("subdir/..");
		expect(upAndDown).toBe(path.normalize(safeDir));
	});

	test("should handle Windows-style paths correctly", () => {
		const cache = new FileEntryCache({
			cwd: safeDir,
			strictPaths: true,
		});

		// Windows-style paths should be normalized
		if (process.platform === "win32") {
			const winPath = cache.getAbsolutePath(".\\allowed.js");
			expect(winPath).toBe(path.normalize(path.join(safeDir, "allowed.js")));

			// Should still block traversal with Windows separators
			expect(() => cache.getAbsolutePath("..\\sensitive.txt")).toThrowError(
				/Path traversal attempt blocked/,
			);
		}
	});
});
