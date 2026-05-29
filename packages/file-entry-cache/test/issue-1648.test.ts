import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import fileEntryCache from "../src/index.js";

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
		const run1 = fileEntryCache.create(cacheId, cacheDir);
		expect(run1.getFileDescriptor(fileA).changed).toBe(true);
		expect(run1.getFileDescriptor(fileB).changed).toBe(true);
		run1.reconcile();

		// Run 2: only file A is inspected. File B changes on disk in the meantime
		// but is NOT inspected, so reconcile() must not revalidate it.
		const run2 = fileEntryCache.create(cacheId, cacheDir);
		expect(run2.getFileDescriptor(fileA).changed).toBe(false);
		fs.writeFileSync(fileB, "b changed");
		run2.reconcile();

		// Run 3: file B must still be reported as changed because it was never
		// inspected (and therefore never revalidated) during run 2.
		const run3 = fileEntryCache.create(cacheId, cacheDir);
		expect(run3.getFileDescriptor(fileB).changed).toBe(true);
	});

	test("2. getFileDescriptor() keeps reporting changed until reconcile", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = fileEntryCache.create(cacheId, cacheDir);

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
		const cache = fileEntryCache.create(cacheId, cacheDir, {
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
		let cache!: ReturnType<typeof fileEntryCache.create>;
		expect(() => {
			cache = fileEntryCache.create(cacheId, cacheDir);
		}).not.toThrow();

		// The cache works and the corrupt file is overwritten on reconcile.
		expect(cache.getFileDescriptor(fileA).changed).toBe(true);
		cache.reconcile();

		const reloaded = fileEntryCache.create(cacheId, cacheDir);
		expect(reloaded.getFileDescriptor(fileA).changed).toBe(false);
	});

	test("reconcile() skips visited entries removed from the underlying cache", () => {
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = fileEntryCache.create(cacheId, cacheDir);

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

		expect(() => fileEntryCache.createFromFile(cachePath)).not.toThrow();
	});

	test("3c. create() rethrows unexpected (non-parse) load errors", () => {
		// A directory at the cache path causes a read (EISDIR) error rather than a
		// parse error. This must propagate instead of silently discarding data.
		const cachePath = path.resolve(`./${cacheDir}/${cacheId}`);
		fs.mkdirSync(cachePath, { recursive: true });

		expect(() => fileEntryCache.create(cacheId, cacheDir)).toThrow();
	});

	test("a file modified between getFileDescriptor and reconcile is detected next run", () => {
		// Regression for reconcile() refreshing size/mtime: the cached entry must
		// reflect the content that was actually inspected, not a later edit. With
		// useModifiedTime (no checksum), refreshing size/mtime at reconcile time
		// would mask a change made after the file was inspected.
		const fileA = path.resolve(`./${fileCacheName}/a.txt`);
		const cache = fileEntryCache.create(cacheId, cacheDir);

		expect(cache.getFileDescriptor(fileA).changed).toBe(true);

		// Modify the file after inspecting it but before reconciling.
		fs.writeFileSync(fileA, "a much longer content than before");
		cache.reconcile();

		// The next run must still see the file as changed, because the cached
		// entry corresponds to the previously-inspected (shorter) content.
		const next = fileEntryCache.create(cacheId, cacheDir);
		expect(next.getFileDescriptor(fileA).changed).toBe(true);
	});
});
