import {describe, test, expect} from 'vitest';
import NodeCache from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('NodeCache', () => {
	test('should create a new instance of NodeCache', () => {
		const cache = new NodeCache();
		expect(cache).toBeInstanceOf(NodeCache);
	});

	test('should create a new instance of NodeCache with options', () => {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const cache = new NodeCache({stdTTL: 10});
		expect(cache).toBeInstanceOf(NodeCache);
		expect(cache.options.stdTTL).toBe(10);
	});

	test('should set and get a key', () => {
		const cache = new NodeCache();
		cache.on('set', (key, value) => {
			expect(key).toBe('foo');
			expect(value).toBe('bar');
		});
		cache.set('foo', 'bar');
		expect(cache.get('foo')).toBe('bar');
	});

	test('should set and get a key with ttl', async () => {
		const cache = new NodeCache();
		cache.set('foo', 'bar', 0.5);
		cache.set('baz', 'qux');
		await sleep(1000);
		expect(cache.get('foo')).toBe(undefined);
		expect(cache.get('baz')).toBe('qux');
	});
});
