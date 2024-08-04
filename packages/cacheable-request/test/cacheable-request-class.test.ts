import {request} from 'node:http';
import {test, expect} from 'vitest';
import Keyv from 'keyv';
import CacheableRequest from '../src/index.js';

test('CacheableRequest is a function', () => {
	expect(typeof CacheableRequest).toBe('function');
});
test('CacheableRequest accepts Keyv instance', () => {
	expect(() => new CacheableRequest(request, new Keyv())).not.toThrow();
});

test('CacheableRequest should accept hook', () => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest.addHook('response', (response: any) => response);
	expect(cacheableRequest.getHook('response')).not.toBeUndefined();
	expect(cacheableRequest.getHook('not')).toBeUndefined();
});

test('CacheableRequest should remove hook', () => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest.addHook('response', (response: any) => response);
	expect(cacheableRequest.getHook('response')).not.toBeUndefined();
	cacheableRequest.removeHook('response');
	expect(cacheableRequest.getHook('response')).toBeUndefined();
});

test('CacheableRequest should run hook', async () => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest.addHook('response', (response: any) => response);
	expect(cacheableRequest.getHook('response')).not.toBeUndefined();
	const value = await cacheableRequest.runHook('response', 10);
	expect(value).toBe(10);
});
