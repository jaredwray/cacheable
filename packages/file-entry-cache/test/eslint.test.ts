import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fileEntryCache from "../src/index.js";

describe("eslint tests scenarios", () => {
	const fileCacheName = "eslint-files";
	const eslintCacheName = ".eslintcache";
	const eslintDirectory = "cache";
	const useCheckSum = true;
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), "test");
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/test2.txt`),
			"test sdfljsdlfjsdflsj",
		);
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), "test3");
		// Src files
		fs.mkdirSync(path.resolve(`./${fileCacheName}/src`));
		fs.writeFileSync(
			path.resolve(`./${fileCacheName}/src/my-file.js`),
			"var foo = 'bar';\r\n",
		);
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {
			recursive: true,
			force: true,
		});
		fs.rmSync(path.resolve(`./${eslintDirectory}`), {
			recursive: true,
			force: true,
		});
	});
	test("about to do absolute paths", () => {
		// Make sure the cache doesnt exist before we start
		fs.rmSync(path.resolve(`./${eslintDirectory}`), {
			recursive: true,
			force: true,
		});
		// This is setting .eslintcache with cache directory
		const cache = fileEntryCache.create(
			eslintCacheName,
			eslintDirectory,
			useCheckSum,
		);
		const myFileJavascriptPath = path.resolve(
			`./${fileCacheName}/src/my-file.js`,
		); // Absolute path
		const myFileJavascriptDescriptor =
			cache.getFileDescriptor(myFileJavascriptPath);
		expect(myFileJavascriptDescriptor.key).toBe(myFileJavascriptPath);
		expect(myFileJavascriptDescriptor.meta).toBeDefined();
		expect(myFileJavascriptDescriptor.changed).toBe(true); // First run
		expect(myFileJavascriptDescriptor.meta?.hash).toBeDefined();

		// Now lets set the data and reconcile
		if (myFileJavascriptDescriptor.meta) {
			myFileJavascriptDescriptor.meta.data = { foo: "bar" };
		}

		// Reconcile
		cache.reconcile();

		// Verify that the data is set
		const myFileJavascriptData = cache.getFileDescriptor(myFileJavascriptPath);
		expect(myFileJavascriptData.meta.data).toStrictEqual({ foo: "bar" });
	});
});
