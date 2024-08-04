import {Agent, request} from 'node:http';
import url from 'node:url';
import util, {promisify as pm} from 'node:util';
import {gzip, gunzip} from 'node:zlib';
import {
	test, beforeAll, afterAll, expect,
} from 'vitest';
import getStream from 'get-stream';
import delay from 'delay';
import sqlite3 from 'sqlite3';
import Keyv from 'keyv';
import CacheableRequest, {CacheValue, onResponse} from '../src/index.js';
import createTestServer from './create-test-server/index.mjs';

// Promisify cacheableRequest
const promisify = (cacheableRequest: any) => async (options: any) => new Promise((resolve, reject) => {
	cacheableRequest(options, async (response: any) => {
		const body = await getStream(response);
		response.body = body;
		// Give the cache time to update
		await delay(100);
		resolve(response);
	})
		.on('request', (request_: any) => request_.end())
		.once('error', reject);
});
let s: any;
beforeAll(async () => {
	s = await createTestServer();
	let noStoreIndex = 0;
	s.get('/no-store', (request_: any, response_: any) => {
		noStoreIndex++;
		response_.setHeader('Cache-Control', 'public, no-cache, no-store');
		response_.end(noStoreIndex.toString());
	});
	let cacheIndex = 0;
	s.get('/cache', (request_: any, response_: any) => {
		cacheIndex++;
		response_.setHeader('Cache-Control', 'public, max-age=60');
		response_.end(cacheIndex.toString());
	});
	s.get('/last-modified', (request_: any, response_: any) => {
		response_.setHeader('Cache-Control', 'public, max-age=0');
		response_.setHeader('Last-Modified', 'Wed, 21 Oct 2015 07:28:00 GMT');
		let responseBody: any = 'last-modified';
		if (
			request_.headers['if-modified-since'] === 'Wed, 21 Oct 2015 07:28:00 GMT'
		) {
			response_.statusCode = 304;
			responseBody = null;
		}

		response_.end(responseBody);
	});
	let date = Date.now() + 200;
	s.get('/stale-revalidate', (request_: any, response_: any) => {
		response_.setHeader('Cache-Control', 'public, max-age=0.05');
		response_.setHeader('stale-if-error', '0.01');
		if (Date.now() <= date) {
			response_.statusCode = 200;
			response_.end('fresh');
		} else if (Date.now() <= date + 600) {
			response_.statusCode = 200;
			response_.end('stale');
		} else {
			response_.statusCode = 200;
			response_.end('new');
		}

		response_.statusCode = 200;
		response_.end('stale-revalidated');
	});
	date = Date.now() + 200;
	s.get('/stale-if-error-success', (request_: any, response_: any) => {
		response_.setHeader('Cache-Control', 'public, max-age=0.05');
		response_.setHeader('stale-if-error', '0.01');
		if (Date.now() <= date) {
			response_.statusCode = 200;
			response_.end('fresh');
		} else if (Date.now() <= date + 600) {
			response_.statusCode = 200;
			response_.end('stale');
		} else {
			response_.statusCode = 200;
			response_.end('new');
		}
	});
	date = Date.now() + 200 + 300;
	s.get('/stale-error', (request_: any, response_: any) => {
		response_.setHeader('Cache-Control', 'public, max-age=0.05');
		response_.setHeader('stale-if-error', '0.01');
		if (Date.now() <= date) {
			response_.statusCode = 200;
			response_.end('fresh');
		} else if (Date.now() <= date + 300) {
			response_.statusCode = 500;
			response_.end('stale');
		}
	});
	let calledFirstError = false;
	s.get('/first-error', (request_: any, response_: any) => {
		if (calledFirstError) {
			response_.end('ok');
			return;
		}

		calledFirstError = true;
		response_.statusCode = 502;
		response_.end('received 502');
	});
	s.get('/etag', (request_: any, response_: any) => {
		response_.setHeader('Cache-Control', 'public, max-age=0');
		response_.setHeader('ETag', '33a64df551425fcc55e4d42a148795d9f25f89d4');
		let responseBody: string | null = 'etag';
		if (
			request_.headers['if-none-match']
						=== '33a64df551425fcc55e4d42a148795d9f25f89d4'
		) {
			response_.statusCode = 304;
			responseBody = null;
		}

		response_.end(responseBody);
	});
	s.get('/revalidate-modified', (request_: any, response_: any) => {
		response_.setHeader('Cache-Control', 'public, max-age=0');
		response_.setHeader('ETag', '33a64df551425fcc55e4d42a148795d9f25f89d4');
		let responseBody = 'revalidate-modified';
		if (
			request_.headers['if-none-match']
						=== '33a64df551425fcc55e4d42a148795d9f25f89d4'
		) {
			response_.setHeader('ETag', '0000000000000000000000000000000000');
			responseBody = 'new-body';
		}

		response_.end(responseBody);
	});
	let cacheThenNoStoreIndex = 0;
	s.get('/cache-then-no-store-on-revalidate', (request_: any, response_: any) => {
		const cc
						= cacheThenNoStoreIndex === 0
							? 'public, max-age=0'
							: 'public, no-cache, no-store';
		cacheThenNoStoreIndex++;
		response_.setHeader('Cache-Control', cc);
		response_.end('cache-then-no-store-on-revalidate');
	});
	s.get('/echo', (request_: any, response_: any) => {
		const {headers, query, path, originalUrl, body} = request_;
		response_.json({
			headers,
			query,
			path,
			originalUrl,
			body,
		});
	});
	const etag = 'foobar';

	const payload = JSON.stringify({foo: 'bar'});
	const compressed = await pm(gzip)(payload);

	s.get('/compress', (request: any, response: any) => {
		if (request.headers['if-none-match'] === etag) {
			response.statusCode = 304;
			response.end();
		} else {
			response.setHeader('content-encoding', 'gzip');
			response.setHeader('cache-control', 'public, max-age: 60');
			response.setHeader('etag', 'foobar');
			response.end(compressed);
		}
	});
});
afterAll(async () => {
	await s.close();
});

test('Non cacheable responses are not cached', async () => {
	const endpoint = '/no-store';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponseIntBody: any = await cacheableRequestHelper(s.url + endpoint);
	const firstResponseInt = Number(firstResponseIntBody.body);
	const secondResponseIntBody: any = await cacheableRequestHelper(s.url + endpoint);
	const secondResponseInt = Number(secondResponseIntBody.body);
	expect(cache.size).toBe(0);
	expect(firstResponseInt < secondResponseInt).toBeTruthy();
});
test('Cacheable responses are cached', async () => {
	const endpoint = '/cache';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint);
	const secondResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(cache.size).toBe(1);
	expect(firstResponse.body).toBe(secondResponse.body);
});
test('Cacheable responses have unique cache key', async () => {
	const endpoint = '/cache';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint + '?foo');
	const secondResponse: any = await cacheableRequestHelper(
		s.url + endpoint + '?bar',
	);
	expect(cache.size).toBe(2);
	expect(firstResponse.body).not.toBe(secondResponse.body);
});

const testCacheKey = async (input: any, expected: string) => {
	const expectKey = `cacheable-request:${expected}`;
	const okMessage = `OK ${expectKey}`;
	const store = new Map();
	const cache = {
		get(key: string) {
			expect(key).toBe(expectKey);
			throw new Error(okMessage);
		},
		set(key: any, value: any, ttl: number) {
			expect(ttl).toBe(1000);
			return store.set(key, value);
		},
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	await expect(cacheableRequestHelper(input)).rejects.toThrow();
};

test('return with GET', async () => testCacheKey('http://www.example.com', 'GET:http://www.example.com'));

test(
	'strips default path',
	async () => testCacheKey('http://www.example.com/', 'GET:http://www.example.com'),
);

test(
	'keeps trailing /',
	async () => testCacheKey('http://www.example.com/test/', 'GET:http://www.example.com/test/'),
);

test(
	'return with GET.',
	async () => testCacheKey(new url.URL('http://www.example.com'), 'GET:http://www.example.com'),
);

test('no requried properties', async () => testCacheKey({}, 'GET:http://localhost'));

test(
	'return without slash',
	async () => testCacheKey(
		{
			protocol: 'http:',
			host: 'www.example.com',
			port: 80,
			path: '/',
		},
		'GET:http://www.example.com',
	));

test(
	'return without port',
	async () => testCacheKey(
		{
			hostname: 'www.example.com',
			port: 80,
			path: '/',
		},
		'GET:http://www.example.com',
	));

test(
	'return with url and port',
	async () => testCacheKey(
		{
			hostname: 'www.example.com',
			port: 8080,
			path: '/',
		},
		'GET:http://www.example.com:8080',
	));

test('return with protocol', async () => testCacheKey({host: 'www.example.com'}, 'GET:http://www.example.com'));

test(
	'hostname over host',
	async () => testCacheKey(
		{
			host: 'www.example.com',
			hostname: 'xyz.example.com',
		},
		'GET:http://xyz.example.com',
	));

test(
	'hostname defaults to localhost',
	async () => testCacheKey(
		{path: '/'},
		'GET:http://localhost',
	));

test(
	'ignores pathname',
	async () => testCacheKey(
		{
			path: '/foo',
			pathname: '/bar',
		},
		'GET:http://localhost/foo',
	));

test(
	'ignores search',
	async () => testCacheKey(
		{
			path: '/?foo=bar',
			search: '?bar=baz',
		},
		'GET:http://localhost/?foo=bar',
	));

test(
	'ignores query',
	async () => testCacheKey(
		{
			path: '/?foo=bar',
			query: {bar: 'baz'},
		},
		'GET:http://localhost/?foo=bar',
	));

test('auth should be in url', async () => testCacheKey({auth: 'user:pass'}, 'GET:http://user:pass@localhost'));

test('should return default url', async () => testCacheKey({method: 'POST'}, 'POST:http://localhost'));
test('request options path query is passed through', async () => {
	const cacheableRequest = new CacheableRequest(request);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const argumentString = `${s.url}/echo?foo=bar`;
	const argumentUrl = new url.URL(argumentString);
	const urlObject = url.parse(argumentString);
	const argumentOptions = {
		hostname: urlObject.hostname,
		port: urlObject.port,
		path: urlObject.path,
	};
	const inputs = [argumentString, argumentUrl, argumentOptions];
	for (const input of inputs) {
		// eslint-disable-next-line no-await-in-loop
		const response: any = await cacheableRequestHelper(input);
		const body = JSON.parse(response.body);
		const message = util.format(
			'when request arg is %s(%j)',
			input.constructor.name,
			input,
		);

		expect(body.query.foo).toBe('bar');
	}
});
test('Setting opts.cache to false bypasses cache for a single request', async () => {
	const endpoint = '/cache';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = url.parse(s.url + endpoint);
	const optionsNoCache = {cache: false, ...options};
	const firstResponse: any = await cacheableRequestHelper(options);
	const secondResponse: any = await cacheableRequestHelper(options);
	const thirdResponse: any = await cacheableRequestHelper(optionsNoCache);
	const fourthResponse: any = await cacheableRequestHelper(options);
	expect(firstResponse.fromCache).toBeFalsy();
	expect(secondResponse.fromCache).toBeTruthy();
	expect(thirdResponse.fromCache).toBeFalsy();
	expect(fourthResponse.fromCache).toBeTruthy();
});
test('TTL is passed to cache', async () => {
	expect.assertions(2);
	const endpoint = '/cache';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set(key: any, value: any, ttl: number) {
			expect(typeof ttl).toBe('number');
			expect(ttl > 0).toBeTruthy();
			return store.set(key, value);
		},
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = {strictTtl: true, ...url.parse(s.url + endpoint)};
	await cacheableRequestHelper(options);
});
test('TTL is not passed to cache if strictTtl is false', async () => {
	expect.assertions(1);
	const endpoint = '/cache';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set(key: any, value: any, ttl: number) {
			expect(ttl === undefined).toBeTruthy();
			return store.set(key, value);
		},
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = {strictTtl: false, ...url.parse(s.url + endpoint)};
	await cacheableRequestHelper(options);
});
test('Setting opts.maxTtl will limit the TTL', async () => {
	expect.assertions(1);
	const endpoint = '/cache';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set(key: any, value: any, ttl: number) {
			expect(ttl).toBe(1000);
			return store.set(key, value);
		},
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = {
		...url.parse(s.url + endpoint),
		maxTtl: 1000,
	};
	await cacheableRequestHelper(options);
});
test('Setting opts.maxTtl when opts.strictTtl is true will use opts.maxTtl if it\'s smaller', async () => {
	expect.assertions(1);
	const endpoint = '/cache';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set(key: any, value: any, ttl: number) {
			expect(ttl === 1000).toBeTruthy();
			return store.set(key, value);
		},
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = {
		...url.parse(s.url + endpoint),
		strictTtl: true,
		maxTtl: 1000,
	};
	await cacheableRequestHelper(options);
});
test('Setting opts.maxTtl when opts.strictTtl is true will use remote TTL if it\'s smaller', async () => {
	expect.assertions(1);
	const endpoint = '/cache';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set(key: any, value: any, ttl: number) {
			expect(ttl < 100_000).toBeTruthy();
			return store.set(key, value);
		},
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = {
		...url.parse(s.url + endpoint),
		strictTtl: true,
		maxTtl: 100_000,
	};
	await cacheableRequestHelper(options);
});
test('Stale cache entries with Last-Modified headers are revalidated', async () => {
	const endpoint = '/last-modified';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint);
	const secondResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(cache.size).toBe(1);
	expect(firstResponse.statusCode).toBe(200);
	expect(secondResponse.statusCode).toBe(200);
	expect(firstResponse.fromCache).toBeFalsy();
	expect(secondResponse.fromCache).toBeTruthy();
	expect(firstResponse.body).toBe('last-modified');
	expect(firstResponse.body).toBe(secondResponse.body);
});

test('Stale cache enteries with stale-if-error-success should send response as expected', async () => {
	const endpoint = '/stale-if-error-success';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(firstResponse.statusCode).toBe(200);
	expect(firstResponse.fromCache).toBeFalsy();
	expect(firstResponse.body).toBe('new');
	expect(cache.size).toBe(1);
	await delay(500);
	const secondResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(secondResponse.statusCode).toBe(200);
	expect(secondResponse.fromCache).toBeFalsy();
	expect(secondResponse.body).toBe('new');
});
test('Stale cache entries with ETag headers are revalidated', async () => {
	const endpoint = '/etag';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint);
	const secondResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(cache.size).toBe(1);
	expect(firstResponse.statusCode).toBe(200);
	expect(secondResponse.statusCode).toBe(200);
	expect(firstResponse.fromCache).toBeFalsy();
	expect(secondResponse.fromCache).toBeTruthy();
	expect(firstResponse.body).toBe('etag');
	expect(firstResponse.body).toBe(secondResponse.body);
});
test('Stale cache entries that can\'t be revalidate are deleted from cache', async () => {
	const endpoint = '/cache-then-no-store-on-revalidate';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(cache.size).toBe(1);
	const secondResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(cache.size).toBe(0);
	expect(firstResponse.statusCode).toBe(200);
	expect(secondResponse.statusCode).toBe(200);
	expect(firstResponse.body).toBe('cache-then-no-store-on-revalidate');
	expect(firstResponse.body).toBe(secondResponse.body);
});
test('Response objects have fromCache property set correctly', async () => {
	const endpoint = '/cache';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const response: any = await cacheableRequestHelper(s.url + endpoint);
	const cachedResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(response.fromCache).toBeFalsy();
	expect(cachedResponse.fromCache).toBeTruthy();
});
test('Revalidated responses that are modified are passed through', async () => {
	const endpoint = '/revalidate-modified';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint);
	const secondResponse: any = await cacheableRequestHelper(s.url + endpoint);
	expect(firstResponse.statusCode).toBe(200);
	expect(secondResponse.statusCode).toBe(200);
	expect(firstResponse.body).toBe('revalidate-modified');
	expect(secondResponse.body).toBe('new-body');
});
test('Undefined callback parameter inside cache logic is handled', async () => {
	const endpoint = '/cache';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	await cacheableRequestHelper(s.url + endpoint);
	await delay(500);
	expect(true).toBeTruthy();
});
test('Custom Keyv instance adapters used', async () => {
	const cache = new Keyv();
	const endpoint = '/cache';
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const response: any = await cacheableRequestHelper(s.url + endpoint);
	const cached = await cache.get(`GET:${s.url + endpoint}`);
	expect(response.body).toBe(cached.body.toString());
});
test('Keyv cache adapters load via connection uri', async () => {
	const endpoint = '/cache';
	const cacheableRequest = new CacheableRequest(
		request,
		'sqlite://test/testdb.sqlite',
	);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const database = new sqlite3.Database('test/testdb.sqlite');
	const firstResponse: any = await cacheableRequestHelper(s.url + endpoint);
	await delay(1000);
	const secondResponse: any = await cacheableRequestHelper(s.url + endpoint);
	database.all(`SELECT * FROM keyv WHERE "key" = "cacheable-request:GET:${
		s.url + endpoint
	}"`, (error, data) => {
		expect(data.length).toBe(1);
		database.all('DELETE FROM keyv');
	});
	expect(firstResponse.fromCache).toBeFalsy();
	expect(secondResponse.fromCache).toBeTruthy();
});
test('ability to force refresh', async () => {
	const endpoint = '/cache';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = url.parse(s.url + endpoint);
	const firstResponse: any = await cacheableRequestHelper(options);
	const secondResponse: any = await cacheableRequestHelper({
		...options,
		forceRefresh: true,
	});
	const thirdResponse: any = await cacheableRequestHelper(options);
	expect(firstResponse.body).not.toBe(secondResponse.body);
	expect(secondResponse.body).toBe(thirdResponse.body);
});
test('checks status codes when comparing cache & response', async () => {
	const endpoint = '/first-error';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = url.parse(s.url + endpoint);
	const firstResponse: any = await cacheableRequestHelper(options);
	const secondResponse: any = await cacheableRequestHelper(options);
	expect(firstResponse.body).toBe('received 502');
	expect(secondResponse.body).toBe('ok');
});

test('304 responses with forceRefresh do not clobber cache', async () => {
	const endpoint = '/etag';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const options = url.parse(s.url + endpoint);

	const firstResponse: any = await cacheableRequestHelper(options);
	const secondResponse: any = await cacheableRequestHelper({...options, forceRefresh: true});
	expect(firstResponse.body).toBe('etag');
	expect(secondResponse.body).toBe('etag');
});

test('decompresses cached responses', async () => {
	const endpoint = '/compress';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	cacheableRequest.addHook('response', async (value: CacheValue) => {
		const buffer = await pm(gunzip)(value.body);
		value.body = buffer.toString();
		return value;
	});
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const response: any = await cacheableRequestHelper(s.url + endpoint);
	expect(response.statusCode).toBe(200);
	const iterator = cache.values();
	const {value} = JSON.parse(iterator.next().value);
	expect(value.body).toBe('{"foo":"bar"}');
});

test('cache status message', async () => {
	const endpoint = '/etag';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	cacheableRequest.addHook(onResponse, (value: CacheValue, response: any) => {
		if (response) {
			value.statusMessage = response.statusMessage;
		}

		return value;
	});
	const response: any = await cacheableRequestHelper(s.url + endpoint);
	const cacheValue = JSON.parse(await cache.get(`cacheable-request:GET:${s.url + endpoint}`));
	expect(cacheValue.value.statusMessage).toBe('OK');
	expect(response.statusCode).toBe(200);
	cacheableRequest.removeHook(onResponse);
});

test('do not cache status message', async () => {
	const endpoint = '/etag';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const response: any = await cacheableRequestHelper(s.url + endpoint);
	const cacheValue = JSON.parse(await cache.get(`cacheable-request:GET:${s.url + endpoint}`));
	expect(cacheValue.value.statusMessage).toBeUndefined();
	expect(response.statusCode).toBe(200);
});
test('socket within keepAlive Agent has been free\'d after cache revalidation', async () => {
	const endpoint = '/last-modified';
	const cache = new Map();
	const cacheableRequest = new CacheableRequest(request, cache);
	const cacheableRequestHelper = promisify(cacheableRequest.request());
	const agent = new Agent({
		keepAlive: true,
	});
	const options = {agent, ...url.parse(s.url + endpoint)};
	try {
		expect(Object.keys(agent.freeSockets)).toHaveLength(0);
		let response: any = await cacheableRequestHelper(options); // 200
		expect(Object.keys(agent.sockets)).toHaveLength(0);
		expect(Object.keys(agent.freeSockets)).toHaveLength(1);
		response = await cacheableRequestHelper(options); // 304
		expect(Object.keys(agent.sockets)).toHaveLength(0);
		expect(Object.keys(agent.freeSockets)).toHaveLength(1);
	} finally {
		agent.destroy();
	}
});
