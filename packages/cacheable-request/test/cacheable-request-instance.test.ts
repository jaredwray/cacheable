import EventEmitter from 'node:events';
import {request} from 'node:http';
import stream from 'node:stream';
import url from 'node:url';
import {
	test, expect, beforeAll, afterAll,
} from 'vitest';
import getStream from 'get-stream';
import CacheableRequest from '../src/index.js';
import {CacheError, RequestError} from '../src/types.js';
import createTestServer from './create-test-server/index.mjs';

let s: any;
beforeAll(async () => {
	s = await createTestServer();
	s.get('/', (request_: any, response_: any) => {
		response_.setHeader('cache-control', 'max-age=60');
		response_.end('hi');
	});
	s.post('/', (request_: any, response_: any) => response_.status(201).end('hello'));
});
afterAll(async () => {
	await s.close();
});
test('cacheableRequest is a class', () => {
	const cacheableRequest = new CacheableRequest(request);
	expect(typeof cacheableRequest).toBe('object');
});
test('cacheableRequest returns an event emitter', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	const returnValue = cacheableRequest(url.parse(s.url), () => true).on('request', (request_: any) => request_.end());
	expect(returnValue instanceof EventEmitter).toBeTruthy();
});

test('cacheableRequest passes requests through if no cache option is set', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	cacheableRequest(url.parse(s.url), async (response: any) => {
		const body = await getStream(response);
		expect(body).toBe('hi');
	}).on('request', (request_: any) => request_.end());
});
test('cacheableRequest accepts url as string', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	cacheableRequest(s.url, async (response: any) => {
		const body = await getStream(response);
		expect(body).toBe('hi');
	}).on('request', (request_: any) => request_.end());
});
test('cacheableRequest accepts url as URL', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	cacheableRequest(new url.URL(s.url), async (response: any) => {
		const body = await getStream(response);
		expect(body).toBe('hi');
	}).on('request', (request_: any) => request_.end());
});
test('cacheableRequest handles no callback parameter', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	cacheableRequest(url.parse(s.url)).on('request', (request_: any) => {
		request_.end();
		request_.on('response', (response: any) => {
			expect(response.statusCode).toBe(200);
		});
	});
});
test('cacheableRequest emits response event for network responses', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	cacheableRequest(url.parse(s.url))
		.on('request', (request_: any) => request_.end())
		.on('response', (response: any) => {
			expect(response.fromCache).toBeFalsy();
		});
});
test('cacheableRequest emits response event for cached responses', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	const cache = new Map();
	const {url} = s;
	const options = Object.assign(url, {cache});
	cacheableRequest(options, () => {
		// This needs to happen in next tick so cache entry has time to be stored
		setImmediate(() => {
			cacheableRequest(options)
				.on('request', (request_: any) => request_.end())
				.on('response', (response: any) => {
					expect(response.fromCache).toBeTruthy();
				});
		});
	}).on('request', (request_: any) => request_.end());
});
test('cacheableRequest emits CacheError if cache adapter connection errors', () => {
	const cacheableRequest = new CacheableRequest(request, 'sqlite://non/existent/database.sqlite').request();
	cacheableRequest(url.parse(s.url))
		.on('error', (error: any) => {
			expect(error instanceof CacheError).toBeTruthy();
			if (error.code === 'SQLITE_CANTOPEN') {
				expect(error.code).toBe('SQLITE_CANTOPEN');
			}
		})
		.on('request', (request_: any) => request_.end());
});
test('cacheableRequest emits CacheError if cache.get errors', async () => {
	const errorMessage = 'Fail';
	const store = new Map();
	const cache = {
		get() {
			throw new Error(errorMessage);
		},
		set: store.set.bind(store),
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache).request();
	cacheableRequest(url.parse(s.url))
		.on('error', (error: any) => {
			expect(error instanceof CacheError).toBeTruthy();
			expect(error.message).toBe(errorMessage);
		})
		.on('request', (request_: any) => request_.end());
});
test('cacheableRequest emits CacheError if cache.set errors', () => {
	const errorMessage = 'Fail';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set() {
			throw new Error(errorMessage);
		},
		delete: store.delete.bind(store),
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache).request();
	cacheableRequest(url.parse(s.url))
		.on('error', (error: any) => {
			expect(error instanceof CacheError).toBeTruthy();
			expect(error.message).toBe(errorMessage);
		})
		.on('request', (request_: any) => request_.end());
});
test('cacheableRequest emits CacheError if cache.delete errors', () => {
	const errorMessage = 'Fail';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set: store.set.bind(store),
		delete() {
			throw new Error(errorMessage);
		},
		clear: store.clear.bind(store),
	};
	const cacheableRequest = new CacheableRequest(request, cache).request();
	(async () => {
		let i = 0;
		const s = await createTestServer();
		s.get('/', (request_, response_) => {
			const cc = i === 0 ? 'public, max-age=0' : 'public, no-cache, no-store';
			i++;
			response_.setHeader('Cache-Control', cc);
			response_.end('hi');
		});
		const url = s.url ?? '';
		cacheableRequest(url, () => {
			// This needs to happen in next tick so cache entry has time to be stored
			setImmediate(() => {
				cacheableRequest(url)
					.on('error', async (error: any) => {
						expect(error instanceof CacheError).toBeTruthy();
						expect(error.message).toBe(errorMessage);
						await s.close();
					})
					.on('request', (request_: any) => request_.end());
			});
		}).on('request', (request_: any) => request_.end());
	})();
});
test('cacheableRequest emits RequestError if request function throws', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	const options: any = url.parse(s.url);
	options.headers = {invalid: '💣'};
	cacheableRequest(options)
		.on('error', (error: any) => {
			expect(error instanceof RequestError).toBeTruthy();
		})
		.on('request', (request_: any) => request_.end());
});
test('cacheableRequest does not cache response if request is aborted before receiving first byte of response', () => {
	/* eslint-disable max-nested-callbacks */

	void createTestServer().then(s => {
		s.get('/delay-start', (request_: any, response_: any) => {
			setTimeout(() => {
				response_.setHeader('cache-control', 'max-age=60');
				response_.end('hi');
			}, 100);
		});
		const cacheableRequest = new CacheableRequest(request).request();

		const options = url.parse(s.url!);
		options.path = '/delay-start';
		cacheableRequest(options)
			.on('request', (request_: any) => {
				request_.end();
				setTimeout(() => { /* do nothing */}, 20);
				setTimeout(() => {
					cacheableRequest(options, async (response: any) => {
						request_.abort();
						expect(response.fromCache).toBe(false);
						const body = await getStream(response);
						expect(body).toBe('hi');
						await s.close();
					}).on('request', (request_: any) => request_.end());
				}, 100);
			});
	});
	/* eslint-enable max-nested-callbacks */
});
test('cacheableRequest does not cache response if request is aborted after receiving part of the response', () => {
	/* eslint-disable max-nested-callbacks */

	void createTestServer().then(s => {
		s.get('/delay-partial', (request_, response_) => {
			response_.setHeader('cache-control', 'max-age=60');
			response_.write('h');
			setTimeout(() => {
				response_.end('i');
			}, 50);
		});
		const cacheableRequest = new CacheableRequest(request).request();

		const options = url.parse(s.url!);
		options.path = '/delay-partial';
		cacheableRequest(options)
			.on('request', (request_: any) => {
				setTimeout(() => {
					request_.abort();
				}, 20);
				setTimeout(() => {
					cacheableRequest(options, async (response: any) => {
						expect(response.fromCache).toBeFalsy();
						const body = await getStream(response);
						expect(body).toBe('hi');
						await s.close();
					}).on('request', (request_: any) => request_.end());
				}, 100);
			});
	});
	/* eslint-enable max-nested-callbacks */
});
test('cacheableRequest makes request even if initial DB connection fails (when opts.automaticFailover is enabled)', async () => {
	const cacheableRequest = new CacheableRequest(request, 'sqlite://non/existent/database.sqlite').request();
	const options: any = url.parse(s.url);
	options.automaticFailover = true;
	cacheableRequest(options, (response_: any) => {
		expect(response_.statusCode).toBe(200);
	})
		.on('error', () => {/* do nothing */})
		.on('request', (request_: any) => request_.end());
});
test('cacheableRequest makes request even if current DB connection fails (when opts.automaticFailover is enabled)', async () => {
	/* eslint-disable unicorn/error-message */
	const cache = {
		get() {
			throw new Error();
		},
		set() {
			throw new Error();
		},
		delete() {
			throw new Error();
		},
		clear() {
			throw new Error();
		},
	};
	/* eslint-enable unicorn/error-message */
	const cacheableRequest = new CacheableRequest(request, cache).request();
	const options: any = url.parse(s.url);
	options.automaticFailover = true;
	cacheableRequest(options, (response_: any) => {
		expect(response_.statusCode).toBe(200);
	})
		.on('error', () => {/* do nothing */})
		.on('request', (request_: any) => request_.end());
});
test('cacheableRequest hashes request body as cache key', async () => {
	const cache = {
		get(k: string) {
			expect(k.split(':').pop()).toBe('5d41402abc4b2a76b9719d911017c592');
		},
		set() {
			throw new Error('cant set');
		},
		delete() {
			throw new Error('cant delete');
		},
		clear() {
			throw new Error('cant clear');
		},
	};
	const cacheableRequest = new CacheableRequest(request, cache).request();
	const options: any = url.parse(s.url);
	options.body = 'hello';
	options.method = 'POST';
	cacheableRequest(options, (response_: any) => {
		expect(response_.statusCode).toBe(201);
	})
		.on('error', () => {/* do nothing */})
		.on('request', (request_: any) => request_.end());
});
test('cacheableRequest skips cache for streamed body', () => {
	const cache = {
		get() {
			throw new CacheError(new Error('Cache error'));
		},
		set() {
			throw new Error('cant set');
		},
		delete() {
			throw new Error('cant delete');
		},
		clear() {
			throw new Error('cant clear');
		},
	};
	const cacheableRequest = new CacheableRequest(request, cache).request();
	const options: any = url.parse(s.url);
	options.body = new stream.PassThrough();
	options.method = 'POST';
	cacheableRequest(options, (response_: any) => {
		expect(response_.statusCode).toBe(201);
	})
		.on('error', () => {/* do nothing */})
		.on('request', (request_: any) => request_.end());
	options.body.end('hello');
});

test('cacheableRequest makes request and cancelled)', async () => {
	const cacheableRequest = new CacheableRequest(request, new Map()).request();
	const options: any = url.parse(s.url);
	cacheableRequest(options, (response_: any) => {
		expect(response_.statusCode).toBe(400);
	})
		.on('error', () => {/* do nothing */})
		.on('request', (request_: any) => request_.abort());
});

test('cacheableRequest emits CacheError if request cancels', () => {
	const cacheableRequest = new CacheableRequest(request).request();
	const options: any = url.parse(s.url);
	options.headers = {invalid: '💣'};
	cacheableRequest(options)
		.on('error', (error: any) => {
			expect(error instanceof CacheError).toBeTruthy();
		})
		.on('request', (request_: any) => request_.abort());
});
