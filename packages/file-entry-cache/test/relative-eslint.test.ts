import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import fileEntryCache, {
	FileEntryCache,
	type FileEntryCacheOptions,
} from "../src/index.js";

describe("eslint tests scenarios", () => {
	test("relative pathing works on files and cache", () => {
		// create the unique cache so there are no conflicts
		const cacheDirectory = ".cache";
		const file = "./index.ts";
		const useCheckSum = true;
		const testFixturesPath = "./test/fixtures-relative";
		const testFixturesPathRename = "./test/fixtures-relative-foo";
		const cache = fileEntryCache.create(
			".eslintcache-foo43",
			cacheDirectory,
			useCheckSum,
			path.resolve("./src"),
		);

		if (cache.useAbsolutePathAsKey) {
			cache.useAbsolutePathAsKey = false;
		}

		const indexDescriptor1 = cache.getFileDescriptor(file);

		expect(indexDescriptor1.changed).toBe(true);

		cache.reconcile();

		// validate that it didnt change
		const indexDescriptor2 = cache.getFileDescriptor(file);

		expect(indexDescriptor2.changed).toBe(false);
		expect(indexDescriptor1.meta.hash).toEqual(indexDescriptor2.meta.hash);

		// copy the file into a temp directory to show a move
		fs.cpSync("./src/index.ts", `${testFixturesPath}/index.ts`, {
			force: true,
		});

		// update the cwd path
		cache.cwd = path.resolve(testFixturesPath);

		const indexDescriptor3 = cache.getFileDescriptor(file);

		// validate that the file via hash is not different
		expect(indexDescriptor3.changed).toBe(false);

		// rename the fixtures path
		fs.renameSync(testFixturesPath, testFixturesPathRename);

		// change the cwd again
		cache.cwd = path.resolve(testFixturesPathRename);

		// get the file again in the new current working directory
		const indexDescriptor4 = cache.getFileDescriptor(file);

		// validate a final time that if renamed folder but file is same it is good
		expect(indexDescriptor4.changed).toBe(false);
		expect(indexDescriptor4.meta.hash).toEqual(indexDescriptor1.meta.hash);

		// clean up
		fs.rmSync(path.resolve(cacheDirectory), {
			recursive: true,
			force: true,
		});

		fs.rmSync(path.resolve(testFixturesPath), {
			recursive: true,
			force: true,
		});

		fs.rmSync(path.resolve(testFixturesPathRename), {
			recursive: true,
			force: true,
		});
	});
	test("Need to use the cache directory as the cwd and use absolute path key", () => {
		const cacheDirectory = "./.cache";
		const cacheId = ".eslintcache-2020111";
		const file = "../src/index.ts";
		const useCheckSum = true;
		const useAbsolutePathAsKey = true;
		const cwd = cacheDirectory;

		const options: FileEntryCacheOptions = {
			useCheckSum,
			useAbsolutePathAsKey,
			cwd,
			cache: {
				cacheId,
				cacheDir: cacheDirectory,
			},
		};

		const cache = new FileEntryCache(options);

		const fileDescriptor = cache.getFileDescriptor(file);

		expect(fileDescriptor.changed).toBe(true);
		expect(fileDescriptor.meta.hash).toBeDefined();

		cache.reconcile();

		const fileDescriptor2 = cache.getFileDescriptor(file);

		expect(fileDescriptor2.changed).toBe(false);
		expect(fileDescriptor2.meta.hash).toBeDefined();
	});
});
