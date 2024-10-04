import fs from 'node:fs';
import path from 'node:path';
import {
	describe, test, expect, beforeAll, afterAll, beforeEach, afterEach,
} from 'vitest';
import defaultFileEntryCache, {FileEntryCache, type FileEntryCacheOptions} from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('file-entry-cache with options', () => {
	test('should initialize', () => {
		const fileEntryCache = new FileEntryCache();
		expect(fileEntryCache).toBeDefined();
	});

	test('should be able to set flat-cache options', () => {
		const fileEntryCache = new FileEntryCache({cache: {cacheId: 'test'}});
		expect(fileEntryCache.cache.cacheId).toBe('test');
	});

	test('should be able to get and set FlatCache', () => {
		const fileEntryCache = new FileEntryCache();
		const newFileEntryCache = new FileEntryCache();
		fileEntryCache.cache = newFileEntryCache.cache;
		expect(fileEntryCache.cache).toBe(newFileEntryCache.cache);
	});

	test('should be able to get and set useCheckSum', () => {
		const fileEntryCache = new FileEntryCache({useCheckSum: true});
		expect(fileEntryCache.useCheckSum).toBe(true);
		fileEntryCache.useCheckSum = false;
		expect(fileEntryCache.useCheckSum).toBe(false);
	});

	test('should be able to get and set currentWorkingDirectory', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: 'test'});
		expect(fileEntryCache.currentWorkingDirectory).toBe('test');
		fileEntryCache.currentWorkingDirectory = 'test2';
		expect(fileEntryCache.currentWorkingDirectory).toBe('test2');
	});

	test('create should initialize a file-entry-cache', () => {
		const fileEntryCache = defaultFileEntryCache.create('test1');
		expect(fileEntryCache).toBeDefined();
	});
});

describe('file-entry-cache - getHash', () => {
	test('should return a hash', () => {
		const fileEntryCache = new FileEntryCache();
		const buffer = Buffer.from('test');
		const hash = fileEntryCache.getHash(buffer);
		expect(hash).toBeDefined();
	});
	test('empty buffer should return md5 empty hash', () => {
		const fileEntryCache = new FileEntryCache();
		const buffer = Buffer.from('');
		const hash = fileEntryCache.getHash(buffer);
		expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e'); // Sha256 hash of empty string
	});
});

describe('file-entry-cache - getFileKey', () => {
	test('should return a key', () => {
		const fileEntryCache = new FileEntryCache();
		const key = fileEntryCache.createFileKey('test');
		expect(key).toBe('test');
	});
	test('should return a correct path key', () => {
		const fileEntryCache = new FileEntryCache();
		const path = '/usr/src/test2/test';
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
	test('should return a correct path key with cwd', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: '/usr/src/test2'});
		const path = '/usr/src/test2/test.file';
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe('/test.file');
	});
	test('should return full path when cwd is full path', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: '/usr/src/test2'});
		const path = '/usr/src/test2';
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
});

describe('file-entry-cache - destroy()', () => {
	test('should return false to delete the file cache', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('foo', 'bar');
		expect(fileEntryCache.cache.all()).toEqual({foo: 'bar'});
		fileEntryCache.destroy();
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe('file-entry-cache - removeEntry()', () => {
	test('should remove the entry', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('foo', 'bar');
		expect(fileEntryCache.cache.all()).toEqual({foo: 'bar'});
		fileEntryCache.removeEntry('foo');
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe('file-entry-cache - removeCacheFile()', () => {
	test('should remove the cache file', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('foo', 'bar');
		expect(fileEntryCache.cache.all()).toEqual({foo: 'bar'});
		fileEntryCache.reconcile();
		expect(fs.existsSync(fileEntryCache.cache.cacheFilePath)).toBe(true);
		fileEntryCache.deleteCacheFile();
		expect(fs.existsSync(fileEntryCache.cache.cacheFilePath)).toBe(false);
		// Clean up
		fs.rmSync(fileEntryCache.cache.cacheDirPath, {recursive: true, force: true});
	});
});

describe('file-entry-cache - getFileDescriptor()', () => {
	const fileCacheName = '.cacheGFD';
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), 'test');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test2.txt`), 'test sdfljsdlfjsdflsj');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), 'test3');
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});

	test('should return non-existent file descriptor', () => {
		const fileEntryCache = new FileEntryCache();
		const fileDescriptor = fileEntryCache.getFileDescriptor('non-existent-file');
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe('non-existent-file');
		expect(fileDescriptor.err).toBeDefined();
		expect(fileDescriptor.notFound).toBe(true);
		expect(fileDescriptor.meta).to.not.toBeDefined();
	});

	test('should return a file descriptor', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve('./.cacheGFD/test1.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.meta).toBeDefined();
		expect(fileDescriptor.meta?.size).toBe(4);
		expect(fileDescriptor.meta?.hash).to.not.toBeDefined();
	});

	test('should return a file descriptor with checksum', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve('./.cacheGFD/test2.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1, {useCheckSum: true});
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.meta?.hash).toBeDefined();
	});

	test('should return a file descriptor with global useCheckSum', () => {
		const fileEntryCache = new FileEntryCache({useCheckSum: true});
		const testFile1 = path.resolve('./.cacheGFD/test2.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.meta?.hash).toBeDefined();
	});

	test('should return a file descriptor with checksum and error', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve('./.cacheGFD/test2.txt');
		fs.chmodSync(testFile1, 0o000);
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1, {useCheckSum: true});
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.err).toBeDefined();
		expect(fileDescriptor.notFound).toBe(true);
	});

	test('should return that the file has not changed', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve('./.cacheGFD/test3.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);

		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(false);
	});

	test('should return that the file has changed', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve('./.cacheGFD/test3.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);

		fs.writeFileSync(testFile1, 'test4 changed');
		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		const meta = fileEntryCache.cache.get(testFile1);
		console.log(meta);
		console.log(fileDescriptor2.meta);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(true);
	});

	test('should return that the file has changed', () => {
		const fileEntryCache = new FileEntryCache({useCheckSum: true});
		const testFile1 = path.resolve('./.cacheGFD/test3.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);
		fs.writeFileSync(testFile1, 'testified');
		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(true);
	});

	test('should return that the file has changed via via time or checksum', () => {
		const fileEntryCache = new FileEntryCache({useCheckSum: true});
		const testFile1 = path.resolve('./.cacheGFD/test1.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);
		const fileDescriptor2 = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor2).toBeDefined();
		expect(fileDescriptor2.key).toBe(testFile1);
		expect(fileDescriptor2.changed).toBe(false);
		expect(fileEntryCache.cache.get(testFile1)).toEqual(fileDescriptor2.meta);
	});

	test('should work with currentWorkingDirectory', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: './.cacheGFD'});
		const fileDescriptor = fileEntryCache.getFileDescriptor('./test1.txt');
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe('./test1.txt');
		expect(fileDescriptor.meta?.size).toBe(4);
		expect(fileDescriptor.changed).toBe(true);
	});

	test('should work with currentWorkingDirectory', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: './.cacheGFD'});
		const fileDescriptor = fileEntryCache.getFileDescriptor('test1.txt');
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe('test1.txt');
		expect(fileDescriptor.meta?.size).toBe(4);
		expect(fileDescriptor.changed).toBe(true);
	});

	test('should not use currentWorkingDirectory', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: './.cacheGFD'});
		const testFile1 = path.resolve('./.cacheGFD/test1.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe(testFile1);
		expect(fileDescriptor.changed).toBe(true);
	});

	test('should cascade currentWorkingDirectory', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: './.cacheGFD'});
		const fileDescriptor = fileEntryCache.getFileDescriptor('test1.txt', {currentWorkingDirectory: './.cacheGFD'});
		expect(fileDescriptor).toBeDefined();
		expect(fileDescriptor.key).toBe('test1.txt');
		expect(fileDescriptor.meta?.size).toBe(4);
		expect(fileDescriptor.changed).toBe(true);
	});
});

describe('file-entry-cache - hasFileChanged()', () => {
	const fileCacheName = '.cacheHFC';
	beforeAll(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), 'test');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test2.txt`), 'test sdfljsdlfjsdflsj');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), 'test3');
	});

	afterAll(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});

	test('should return false for non-existent file', () => {
		const fileEntryCache = new FileEntryCache();
		expect(fileEntryCache.hasFileChanged('non-existent-file')).toBe(false);
	});

	test('should return true for first time file', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve('./.cacheHFC/test1.txt');
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(true);
	});

	test('should return true for changed file', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = path.resolve('./.cacheHFC/test1.txt');
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(true);
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(false);
		fs.writeFileSync(testFile1, 'test4');
		expect(fileEntryCache.hasFileChanged(testFile1)).toBe(true);
	});
});

describe('file-entry-cache - normalizeEntries()', () => {
	const fileCacheName = '.cacheNE';
	beforeAll(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), 'test');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test2.txt`), 'test sdfljsdlfjsdflsj');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), 'test3');
	});

	afterAll(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});
	test('should return an empty array', () => {
		const fileEntryCache = new FileEntryCache();
		const entries = fileEntryCache.normalizeEntries([]);
		expect(entries).toEqual([]);
	});
	test('should return an array of entries', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: `./${fileCacheName}`});
		fileEntryCache.getFileDescriptor('test2.txt');
		const entries = fileEntryCache.normalizeEntries(['test1.txt', 'test2.txt']);
		expect(entries[0].key).toBe('test1.txt');
		expect(entries[0].changed).toBe(true);
		expect(entries[1].key).toBe('test2.txt');
		expect(entries[1].changed).toBe(false);
	});
});

describe('file-entry-cache - reconcile()', () => {
	const fileCacheName = '.cacheReconcile';
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), 'test');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test2.txt`), 'test sdfljsdlfjsdflsj');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), 'test3');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), 'test4');
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});

	test('should reconcile the cache', () => {
		const options: FileEntryCacheOptions = {
			currentWorkingDirectory: `./${fileCacheName}`,
			cache: {
				cacheId: 'test1',
				cacheDir: './.cacheReconcile',
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		const fileEntry1 = fileEntryCache.getFileDescriptor('test1.txt');
		if (fileEntry1.meta) {
			fileEntry1.meta.data = {testingFooVariable: '11'};
		}

		fileEntryCache.getFileDescriptor('test2.txt');
		fileEntryCache.getFileDescriptor('test3.txt');
		fileEntryCache.reconcile();
		const cacheFileContent = fs.readFileSync(fileEntryCache.cache.cacheFilePath, 'utf8');
		expect(cacheFileContent).toContain('test2.txt');
		expect(cacheFileContent).toContain('test3.txt');
		expect(cacheFileContent).toContain('"testingFooVariable"');
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});

	test('should reconcile with deleted files', () => {
		const options: FileEntryCacheOptions = {
			currentWorkingDirectory: `./${fileCacheName}`,
			cache: {
				cacheId: 'test1',
				cacheDir: './.cacheReconcile',
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		fileEntryCache.getFileDescriptor('test1.txt');
		fileEntryCache.getFileDescriptor('test2.txt');
		fileEntryCache.getFileDescriptor('test3.txt');
		fileEntryCache.getFileDescriptor('test4.txt');
		const testFile4 = path.resolve(`./${fileCacheName}/test4.txt`);
		fs.unlinkSync(testFile4);

		fileEntryCache.reconcile();

		const cacheFileContent = fs.readFileSync(fileEntryCache.cache.cacheFilePath, 'utf8');
		expect(cacheFileContent).toContain('test1.txt');
		expect(cacheFileContent).toContain('test2.txt');
		expect(cacheFileContent).toContain('test3.txt');
		expect(cacheFileContent).not.toContain('test4.txt');
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});
});

describe('file-entry-cache - analyzeFiles()', () => {
	const fileCacheName = 'analyzeFiles';
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), 'test');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test2.txt`), 'test sdfljsdlfjsdflsj');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), 'test3');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), 'test4');
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});

	test('should analyze files', () => {
		const options: FileEntryCacheOptions = {
			currentWorkingDirectory: `./${fileCacheName}`,
			cache: {
				cacheId: 'test1',
				cacheDir: './.cacheAnalyzeFiles',
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		const files = ['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt'];
		const analyzedFiles = fileEntryCache.analyzeFiles(files);
		expect(analyzedFiles).toBeDefined();
		expect(analyzedFiles.changedFiles.length).toBe(4);
	});

	test('should analyze files with removed ones', () => {
		const options: FileEntryCacheOptions = {
			currentWorkingDirectory: `./${fileCacheName}`,
			cache: {
				cacheId: 'test1',
				cacheDir: './.cacheAnalyzeFiles',
			},
		};
		const fileEntryCache = new FileEntryCache(options);
		const files = ['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt'];
		const analyzedFiles = fileEntryCache.analyzeFiles(files);
		expect(analyzedFiles).toBeDefined();
		expect(analyzedFiles.changedFiles.length).toBe(4);
		const testFile4 = path.resolve(`./${fileCacheName}/test4.txt`);
		fs.unlinkSync(testFile4);
		const analyzedFiles2 = fileEntryCache.analyzeFiles(files);
		expect(analyzedFiles2.changedFiles.length).toBe(0);
		expect(analyzedFiles2.notChangedFiles.length).toBe(3);
		expect(analyzedFiles2.notFoundFiles.length).toBe(1);
	});
});

describe('file-entry-cache - getUpdatedFiles()', () => {
	const fileCacheName = 'getUpdatedFiles';
	beforeEach(() => {
		// Generate files for testing
		fs.mkdirSync(path.resolve(`./${fileCacheName}`));
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), 'test');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test2.txt`), 'test sdfljsdlfjsdflsj');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test3.txt`), 'test3');
		fs.writeFileSync(path.resolve(`./${fileCacheName}/test4.txt`), 'test4');
	});

	afterEach(() => {
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
	});

	test('should return empty array on get updated files', () => {
		const options: FileEntryCacheOptions = {
			currentWorkingDirectory: `./${fileCacheName}`,
		};
		const fileEntryCache = new FileEntryCache(options);
		const files = ['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt'];
		const updatedFiles = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles).toEqual(['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt']);
		const updatedFiles2 = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles2).toEqual([]);
	});

	test('should return updated files if one is updated', () => {
		const options: FileEntryCacheOptions = {
			currentWorkingDirectory: `./${fileCacheName}`,
		};
		const fileEntryCache = new FileEntryCache(options);
		const files = ['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt'];
		const updatedFiles = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles).toEqual(['test1.txt', 'test2.txt', 'test3.txt', 'test4.txt']);
		const testFile4 = path.resolve(`./${fileCacheName}/test4.txt`);
		fs.writeFileSync(testFile4, 'test5booosdkfjsldfkjsldkjfls');
		const updatedFiles2 = fileEntryCache.getUpdatedFiles(files);
		expect(updatedFiles2).toEqual(['test4.txt']);
	});
});
