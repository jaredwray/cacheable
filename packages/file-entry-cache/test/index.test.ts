import fs from 'node:fs';
import path from 'node:path';
import {
	describe, test, expect, beforeAll, afterAll, beforeEach, afterEach,
} from 'vitest';
import defaultFileEntryCache, {createFromFile, FileEntryCache, type FileEntryCacheOptions} from '../src/index.js';

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
		fs.rmSync(fileEntryCache.cache.cacheDirPath, {recursive: true, force: true});
	});

	test('should initialize with hashAlgorithm', () => {
		const fileEntryCache = new FileEntryCache({hashAlgorithm: 'sha256'});
		expect(fileEntryCache.hashAlgorithm).toBe('sha256');
		fileEntryCache.hashAlgorithm = 'md5';
		expect(fileEntryCache.hashAlgorithm).toBe('md5');
	});
});

describe('getHash', () => {
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

describe('getFileKey', () => {
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
		expect(key).toBe('test.file');
	});
	test('should return full path when cwd is full path', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: '/usr/src/test2'});
		const path = '/usr/src/test2';
		const key = fileEntryCache.createFileKey(path);
		expect(key).toBe(path);
	});
});

describe('destroy()', () => {
	test('should return false to delete the file cache', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('foo', 'bar');
		expect(fileEntryCache.cache.all()).toEqual({foo: 'bar'});
		fileEntryCache.destroy();
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe('removeEntry()', () => {
	test('test relative path and absolute path', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('/usr/src/test2/test', 'bar');
		// eslint-disable-next-line @typescript-eslint/naming-convention
		expect(fileEntryCache.cache.all()).toEqual({'/usr/src/test2/test': 'bar'});
		fileEntryCache.removeEntry('test', {currentWorkingDirectory: '/usr/src/test2'});
		expect(fileEntryCache.cache.all()).toEqual({});
	});

	test('should not work if passing a absolute path to a relative key', () => {
		const fileEntryCache = new FileEntryCache();
		fileEntryCache.cache.setKey('testified', 'bar');

		expect(fileEntryCache.cache.all()).toEqual({testified: 'bar'});
		fileEntryCache.removeEntry('/usr/src/test2/testified', {currentWorkingDirectory: '/usr/src/test2'});
		expect(fileEntryCache.cache.all()).toEqual({});
	});
});

describe('removeCacheFile()', () => {
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

describe('getFileDescriptor()', () => {
	const fileCacheName = '.cacheGFD';
	beforeEach(() => {
		// Generate files for testing
		fs.rmSync(path.resolve(`./${fileCacheName}`), {recursive: true, force: true});
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
		expect(fileDescriptor.meta.data).to.not.toBeDefined();
	});

	test('should save the meta data after the first call and loading data', () => {
		const shared = {shared: 'shared'};
		const data = {testingFooVariable: '11', name: 'test1.txt', shared};
		const fileEntryCache = new FileEntryCache({useCheckSum: true});
		const testFile1 = path.resolve('./.cacheGFD/test1.txt');
		const fileDescriptor = fileEntryCache.getFileDescriptor(testFile1);
		fileDescriptor.meta.data = data;
		expect(fileDescriptor).toBeDefined();
		fileEntryCache.reconcile();

		// Add the meta data to the cache
		const fileEntryCache2 = createFromFile(fileEntryCache.cache.cacheFilePath, true);
		const fileDescriptor2 = fileEntryCache2.getFileDescriptor(testFile1);
		const data2 = {testingFooVariable: '22', name: 'test1.txt', shared};
		fileDescriptor2.meta.data = data2;
		fileEntryCache2.reconcile();

		// Load the meta data from the cache
		const fileEntryCache3 = createFromFile(fileEntryCache.cache.cacheFilePath, true);
		const fileDescriptor3 = fileEntryCache3.getFileDescriptor(testFile1);
		expect(fileDescriptor3).toBeDefined();
		expect(fileDescriptor3.meta.data).toEqual(data2);

		// Verify that the data shows changed
		const fileDescriptor4 = fileEntryCache3.getFileDescriptor(testFile1);
		expect(fileDescriptor4).toBeDefined();
		expect(fileDescriptor4.meta.data).toEqual(data2);
		expect(fileDescriptor4.changed).toEqual(true);
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
		expect(fileDescriptor.notFound).toBe(false);
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

	test('should default to process.cwd() if current workind directory not set', () => {
		const fileEntryCache = new FileEntryCache();
		const testFile1 = './.cacheGFD/test1.txt';
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

describe('hasFileChanged()', () => {
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

describe('normalizeEntries()', () => {
	const fileCacheName = '.cacheNE';
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

	test('should return all entries', () => {
		const fileEntryCache = new FileEntryCache({useCheckSum: true, currentWorkingDirectory: `./${fileCacheName}`});
		fileEntryCache.getFileDescriptor('test1.txt');
		fileEntryCache.getFileDescriptor('test2.txt');
		fileEntryCache.getFileDescriptor('test3.txt');
		fs.chmodSync(path.resolve(`./${fileCacheName}/test3.txt`), 0o000);
		const entries = fileEntryCache.normalizeEntries();
		expect(entries.length).toBe(2);
		expect(entries[0].key).toBe('test1.txt');
		expect(entries[0].changed).toBe(false);
		expect(entries[1].key).toBe('test2.txt');
		expect(entries[1].changed).toBe(false);
	});
});

describe('reconcile()', () => {
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

describe('analyzeFiles()', () => {
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

describe('getUpdatedFiles()', () => {
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

describe('createFromFile()', () => {
	const fileCacheName = 'createFromFiles';
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
	test('should create a file entry cache from a file', () => {
		const filePath = path.resolve('./.testCacheCFF/test1');
		const cacheId = path.basename(filePath);
		const cacheDirectory = path.dirname(filePath);
		const fileEntryCacheOptions = {
			cache: {
				cacheId,
				cacheDir: cacheDirectory,
			},
			currentWorkingDirectory: `./${fileCacheName}`,
		};
		const fileEntryCache1 = new FileEntryCache(fileEntryCacheOptions);
		fileEntryCache1.getFileDescriptor('test1.txt');
		fileEntryCache1.getFileDescriptor('test2.txt');
		fileEntryCache1.getFileDescriptor('test3.txt');
		fileEntryCache1.getFileDescriptor('test4.txt');
		fileEntryCache1.reconcile();
		const fileEntryCache2 = defaultFileEntryCache.createFromFile(filePath, undefined, `./${fileCacheName}`);
		expect(fileEntryCache2.cache.cacheId).toBe(cacheId);
		expect(fileEntryCache2.cache.cacheDir).toBe(cacheDirectory);
		expect(fileEntryCache2.currentWorkingDirectory).toBe(`./${fileCacheName}`);
		expect(fileEntryCache2.cache.all()).toEqual(fileEntryCache1.cache.all());
		fs.rmSync(path.resolve(cacheDirectory), {recursive: true, force: true});
	});
	test('should detect if a file has changed prior to creating a file entry cache from a file', () => {
		const filePath = path.resolve('./.testCacheCFF/test1');
		const cacheId = path.basename(filePath);
		const cacheDirectory = path.dirname(filePath);
		const fileEntryCacheOptions = {
			cache: {
				cacheId,
				cacheDir: cacheDirectory,
			},
			currentWorkingDirectory: `./${fileCacheName}`,
		};
		const fileEntryCache1 = new FileEntryCache(fileEntryCacheOptions);
		fileEntryCache1.getFileDescriptor('test1.txt');
		fileEntryCache1.reconcile();

		fs.writeFileSync(path.resolve(`./${fileCacheName}/test1.txt`), 'modified');

		const fileEntryCache2 = defaultFileEntryCache.createFromFile(filePath, undefined, `./${fileCacheName}`);
		expect(fileEntryCache2.getUpdatedFiles(['test1.txt']).length).toBe(1);
		fileEntryCache2.reconcile();

		const fileEntryCache3 = defaultFileEntryCache.createFromFile(filePath, undefined, `./${fileCacheName}`);
		expect(fileEntryCache3.getUpdatedFiles(['test1.txt']).length).toBe(0);
		fs.rmSync(path.resolve(cacheDirectory), {recursive: true, force: true});
	});
});

describe('getFileDescriptorsByPath()', () => {
	const fileCacheName = 'filesGFDBP';
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
	test('should return an empty array', () => {
		const fileEntryCache = new FileEntryCache();
		const fileDescriptors = fileEntryCache.getFileDescriptorsByPath('/foo/bar');
		expect(fileDescriptors).toEqual([]);
	});

	test('should return an array of file descriptors', () => {
		const fileEntryCache = new FileEntryCache({currentWorkingDirectory: `./${fileCacheName}`});
		fileEntryCache.getFileDescriptor('test1.txt');
		fileEntryCache.getFileDescriptor('test2.txt');
		fileEntryCache.getFileDescriptor('test3.txt');
		const absolutePath = path.resolve(`./${fileCacheName}/`);
		const fileDescriptors = fileEntryCache.getFileDescriptorsByPath(absolutePath);
		expect(fileDescriptors.length).toBe(3);
		expect(fileDescriptors[0].key).toBe('test1.txt');
	});
});

describe('renameAbsolutePathKeys()', () => {
	const fileCacheName = 'filesRAPK';
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

	test('should handle rename of absolute paths', () => {
		const fileEntryCache = new FileEntryCache();
		const file1 = path.resolve(`./${fileCacheName}/test1.txt`);
		const file2 = path.resolve(`./${fileCacheName}/test2.txt`);
		const file3 = path.resolve(`./${fileCacheName}/test3.txt`);
		fileEntryCache.getFileDescriptor(file1);
		fileEntryCache.getFileDescriptor(file2);
		fileEntryCache.getFileDescriptor(file3);
		const keys = fileEntryCache.cache.keys();
		expect(keys.length).toBe(3);
		expect(keys[0]).toBe(file1);
		expect(keys[1]).toBe(file2);
		expect(keys[2]).toBe(file3);
		const oldFileCacheNamePath = path.resolve(`./${fileCacheName}`);
		const newFileCacheNamePath = path.resolve(`${fileCacheName}-new`);
		fileEntryCache.renameAbsolutePathKeys(oldFileCacheNamePath, newFileCacheNamePath);
		const newKeys = fileEntryCache.cache.keys();
		expect(newKeys.length).toBe(3);
		expect(newKeys[0]).toBe(`${newFileCacheNamePath}/test1.txt`);
		expect(newKeys[1]).toBe(`${newFileCacheNamePath}/test2.txt`);
		expect(newKeys[2]).toBe(`${newFileCacheNamePath}/test3.txt`);
	});

	test('should handle rename of absolute paths with reconcile', () => {
		const fileEntryCache = new FileEntryCache();
		const file1 = path.resolve(`./${fileCacheName}/test1.txt`);
		const file2 = path.resolve(`./${fileCacheName}/test2.txt`);
		const file3 = path.resolve(`./${fileCacheName}/test3.txt`);
		fileEntryCache.getFileDescriptor(file1);
		fileEntryCache.getFileDescriptor(file2);
		fileEntryCache.getFileDescriptor(file3);
		const keys = fileEntryCache.cache.keys();
		expect(keys.length).toBe(3);
		expect(keys[0]).toBe(file1);
		expect(keys[1]).toBe(file2);
		expect(keys[2]).toBe(file3);
		const oldFileCacheNamePath = path.resolve(`./${fileCacheName}`);
		const newFileCacheNamePath = path.resolve(`${fileCacheName}-new`);
		fs.renameSync(oldFileCacheNamePath, newFileCacheNamePath);
		fileEntryCache.renameAbsolutePathKeys(oldFileCacheNamePath, newFileCacheNamePath);
		const newKeys = fileEntryCache.cache.keys();
		expect(newKeys.length).toBe(3);
		expect(newKeys[0]).toBe(`${newFileCacheNamePath}/test1.txt`);
		expect(newKeys[1]).toBe(`${newFileCacheNamePath}/test2.txt`);
		expect(newKeys[2]).toBe(`${newFileCacheNamePath}/test3.txt`);
		fileEntryCache.reconcile();
		// Should show not changed as it is just a folder rename
		const fileEntry1 = fileEntryCache.getFileDescriptor(`${newFileCacheNamePath}/test1.txt`);
		expect(fileEntry1.changed).toBe(false);

		const fileEntry2 = fileEntryCache.getFileDescriptor(`${newFileCacheNamePath}/test2.txt`);
		expect(fileEntry2.changed).toBe(false);

		fs.rmSync(newFileCacheNamePath, {recursive: true, force: true});
		fs.rmSync(fileEntryCache.cache.cacheDirPath, {recursive: true, force: true});
	});
});
