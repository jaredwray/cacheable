import fs from 'node:fs';
import {describe, test, expect} from 'vitest';
import {FileEntryCache} from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('file-entry-cache', () => {
	test('should initialize', () => {
		const cache = new FileEntryCache();
		expect(cache).toBeDefined();
	});
});
