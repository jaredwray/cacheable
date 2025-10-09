import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fileEntryCache from "../src/index.js";

describe("file-rename with cwd", () => {
	const testBaseDir = path.resolve(process.cwd(), "../test-rename-base");
	const uniqueFolderName = `test-folder-${Date.now()}`;
	const renamedFolderName = `renamed-folder-${Date.now()}`;
	const originalPath = path.join(testBaseDir, uniqueFolderName);
	const renamedPath = path.join(testBaseDir, renamedFolderName);
	const cacheDir = path.resolve(__dirname, "cache-rename");
	const cacheFile = ".rename-cache";
	const testFileName = "test-file.js";
	const testFileContent = 'console.log("Hello from test file");\n';

	beforeEach(() => {
		// Clean up any existing test directories
		if (fs.existsSync(testBaseDir)) {
			fs.rmSync(testBaseDir, { recursive: true, force: true });
		}
		if (fs.existsSync(cacheDir)) {
			fs.rmSync(cacheDir, { recursive: true, force: true });
		}
	});

	afterEach(() => {
		// Clean up
		if (fs.existsSync(testBaseDir)) {
			fs.rmSync(testBaseDir, { recursive: true, force: true });
		}
		if (fs.existsSync(cacheDir)) {
			fs.rmSync(cacheDir, { recursive: true, force: true });
		}
	});

	test("should maintain cache validity when folder is renamed using relative paths with cwd", () => {
		// Step 1: Create unique folder with a file
		fs.mkdirSync(originalPath, { recursive: true });
		const testFilePath = path.join(originalPath, testFileName);
		fs.writeFileSync(testFilePath, testFileContent);

		// Step 2: Create file-entry-cache with cwd pointing to the unique folder
		const cache1 = fileEntryCache.create(
			cacheFile,
			cacheDir,
			true, // useCheckSum for more reliable change detection
			originalPath, // cwd set to the unique folder
		);

		cache1.keyAsAbsolutePath = false;

		// Step 3: Get file descriptor using relative path
		const descriptor1 = cache1.getFileDescriptor(testFileName);

		// Verify it's detected as changed (first time)
		expect(descriptor1).toBeDefined();
		expect(descriptor1.key).toBe(testFileName);
		expect(descriptor1.changed).toBe(true);
		expect(descriptor1.notFound).toBeUndefined();
		expect(descriptor1.meta?.size).toBe(testFileContent.length);
		expect(descriptor1.meta?.hash).toBeDefined();

		// Add some metadata to verify it persists
		if (descriptor1.meta) {
			descriptor1.meta.data = {
				processedAt: Date.now(),
				status: "validated",
			};
		}

		// Step 4: Reconcile to save cache
		cache1.reconcile();

		// Verify cache file was created
		const cachePath = path.join(cacheDir, cacheFile);
		expect(fs.existsSync(cachePath)).toBe(true);

		// Step 5: Rename the folder
		fs.renameSync(originalPath, renamedPath);

		// Step 6: Create new file-entry-cache instance with cwd pointing to renamed folder
		const cache2 = fileEntryCache.create(
			cacheFile,
			cacheDir,
			true, // useCheckSum
			renamedPath, // cwd now points to the renamed folder
		);

		cache2.keyAsAbsolutePath = false;

		// Step 7: Access the file using the same relative path
		const descriptor2 = cache2.getFileDescriptor(testFileName);

		// Verify the file is recognized as unchanged
		expect(descriptor2).toBeDefined();
		expect(descriptor2.key).toBe(testFileName);
		expect(descriptor2.changed).toBe(false); // Should be false - file hasn't changed
		expect(descriptor2.notFound).toBeUndefined();

		// Verify metadata persisted
		expect(descriptor2.meta?.data).toBeDefined();
		const data = descriptor2.meta?.data as {
			processedAt: number;
			status: string;
		};
		expect(data.status).toBe("validated");

		// Verify the file still exists at the new location
		const newTestFilePath = path.join(renamedPath, testFileName);
		expect(fs.existsSync(newTestFilePath)).toBe(true);

		// Verify content is the same
		const currentContent = fs.readFileSync(newTestFilePath, "utf8");
		expect(currentContent).toBe(testFileContent);

		// Additional verification: modify the file and check it's detected
		fs.writeFileSync(newTestFilePath, `${testFileContent}// Modified\n`);

		const descriptor3 = cache2.getFileDescriptor(testFileName);
		expect(descriptor3.changed).toBe(true); // Now it should be changed
	});

	test("should handle multiple files when folder is renamed", () => {
		// Create folder with multiple files
		fs.mkdirSync(originalPath, { recursive: true });

		const files = [
			{ name: "index.js", content: 'export default "index";\n' },
			{ name: "utils.js", content: "export const util = () => {};\n" },
			{ name: "config.json", content: '{"version": "1.0.0"}\n' },
		];

		// Write all files
		files.forEach((file) => {
			fs.writeFileSync(path.join(originalPath, file.name), file.content);
		});

		// Create cache with original folder
		const cache1 = fileEntryCache.create(
			cacheFile,
			cacheDir,
			true,
			originalPath,
		);

		cache1.keyAsAbsolutePath = false;

		// Process all files
		files.forEach((file) => {
			const desc = cache1.getFileDescriptor(file.name);
			expect(desc.changed).toBe(true);
			if (desc.meta) {
				desc.meta.data = { originalName: file.name };
			}
		});

		// Save cache
		cache1.reconcile();

		// Rename folder
		fs.renameSync(originalPath, renamedPath);

		// Create new cache with renamed folder
		const cache2 = fileEntryCache.create(
			cacheFile,
			cacheDir,
			true,
			renamedPath,
		);

		cache2.keyAsAbsolutePath = false;

		// Verify all files are still cached and unchanged
		files.forEach((file) => {
			const desc = cache2.getFileDescriptor(file.name);
			expect(desc.changed).toBe(false);
			expect(desc.meta?.data).toStrictEqual({ originalName: file.name });
		});
	});
});
