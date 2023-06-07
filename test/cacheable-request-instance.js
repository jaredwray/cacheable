import EventEmitter from 'events';
import { request } from 'http';
import url from 'url';
import test from 'ava';
import createTestServer from 'create-test-server';
import getStream from 'get-stream';
import CacheableRequest from 'this';

let s;

test.before('setup', async () => {
	s = await createTestServer();
	s.get('/', (req, res) => {
		res.setHeader('cache-control', 'max-age=60');
		res.end('hi');
	});
});

test('cacheableRequest is a function', t => {
	const cacheableRequest = new CacheableRequest(request);
	t.is(typeof cacheableRequest, 'function');
});

test.cb('cacheableRequest returns an event emitter', t => {
	const cacheableRequest = new CacheableRequest(request);
	const returnValue = cacheableRequest(url.parse(s.url), () => t.end()).on('request', req => req.end());
	t.true(returnValue instanceof EventEmitter);
});

test.cb('cacheableRequest passes requests through if no cache option is set', t => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest(url.parse(s.url), async response => {
		const body = await getStream(response);
		t.is(body, 'hi');
		t.end();
	}).on('request', req => req.end());
});

test.cb('cacheableRequest accepts url as string', t => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest(s.url, async response => {
		const body = await getStream(response);
		t.is(body, 'hi');
		t.end();
	}).on('request', req => req.end());
});

test.cb('cacheableRequest accepts url as URL', t => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest(new url.URL(s.url), async response => {
		const body = await getStream(response);
		t.is(body, 'hi');
		t.end();
	}).on('request', req => req.end());
});

test.cb('cacheableRequest handles no callback parameter', t => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest(url.parse(s.url)).on('request', req => {
		req.end();
		req.on('response', response => {
			t.is(response.statusCode, 200);
			t.end();
		});
	});
});

test.cb('cacheableRequest emits response event for network responses', t => {
	const cacheableRequest = new CacheableRequest(request);
	cacheableRequest(url.parse(s.url))
		.on('request', req => req.end())
		.on('response', response => {
			t.false(response.fromCache);
			t.end();
		});
});

test.cb('cacheableRequest emits response event for cached responses', t => {
	const cacheableRequest = new CacheableRequest(request);
	const cache = new Map();
	const opts = Object.assign(url.parse(s.url), { cache });
	cacheableRequest(opts, () => {
		// This needs to happen in next tick so cache entry has time to be stored
		setImmediate(() => {
			cacheableRequest(opts)
				.on('request', req => req.end())
				.on('response', response => {
					t.true(response.fromCache);
					t.end();
				});
		});
	}).on('request', req => req.end());
});

test.cb('cacheableRequest emits CacheError if cache adapter connection errors', t => {
	const cacheableRequest = new CacheableRequest(request, 'sqlite://non/existent/database.sqlite');
	cacheableRequest(url.parse(s.url))
		.on('error', err => {
			t.true(err instanceof CacheableRequest.CacheError);
			t.is(err.code, 'SQLITE_CANTOPEN');
			t.end();
		})
		.on('request', req => req.end());
});

test.cb('cacheableRequest emits CacheError if cache.get errors', t => {
	const errMessage = 'Fail';
	const store = new Map();
	const cache = {
		get: () => {
			throw new Error(errMessage);
		},
		set: store.set.bind(store),
		delete: store.delete.bind(store)
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	cacheableRequest(url.parse(s.url))
		.on('error', err => {
			t.true(err instanceof CacheableRequest.CacheError);
			t.is(err.message, errMessage);
			t.end();
		})
		.on('request', req => req.end());
});

test.cb('cacheableRequest emits CacheError if cache.set errors', t => {
	const errMessage = 'Fail';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set: () => {
			throw new Error(errMessage);
		},
		delete: store.delete.bind(store)
	};
	const cacheableRequest = new CacheableRequest(request, cache);
	cacheableRequest(url.parse(s.url))
		.on('error', err => {
			t.true(err instanceof CacheableRequest.CacheError);
			t.is(err.message, errMessage);
			t.end();
		})
		.on('request', req => req.end());
});

test.cb('cacheableRequest emits CacheError if cache.delete errors', t => {
	const errMessage = 'Fail';
	const store = new Map();
	const cache = {
		get: store.get.bind(store),
		set: store.set.bind(store),
		delete: () => {
			throw new Error(errMessage);
		}
	};
	const cacheableRequest = new CacheableRequest(request, cache);

	(async () => {
		let i = 0;
		const s = await createTestServer();
		s.get('/', (req, res) => {
			const cc = i === 0 ? 'public, max-age=0' : 'public, no-cache, no-store';
			i++;
			res.setHeader('Cache-Control', cc);
			res.end('hi');
		});

		cacheableRequest(s.url, () => {
			// This needs to happen in next tick so cache entry has time to be stored
			setImmediate(() => {
				cacheableRequest(s.url)
					.on('error', async err => {
						t.true(err instanceof CacheableRequest.CacheError);
						t.is(err.message, errMessage);
						await s.close();
						t.end();
					})
					.on('request', req => req.end());
			});
		}).on('request', req => req.end());
	})();
});

test.cb('cacheableRequest emits RequestError if request function throws', t => {
	const cacheableRequest = new CacheableRequest(request);
	const opts = url.parse(s.url);
	opts.headers = { invalid: '💣' };
	cacheableRequest(opts)
		.on('error', err => {
			t.true(err instanceof CacheableRequest.RequestError);
			t.end();
		})
		.on('request', req => req.end());
});

test.cb('cacheableRequest does not cache response if request is aborted before receiving first byte of response', t => {
	/* eslint-disable max-nested-callbacks */
	// eslint-disable-next-line promise/prefer-await-to-then
	createTestServer().then(s => {
		s.get('/delay-start', (req, res) => {
			setTimeout(() => {
				res.setHeader('cache-control', 'max-age=60');
				res.end('hi');
			}, 50);
		});

		const cacheableRequest = new CacheableRequest(request);
		const opts = url.parse(s.url);
		opts.path = '/delay-start';
		cacheableRequest(opts)
			.on('request', req => {
				req.end();

				setTimeout(() => {
					req.abort();
				}, 20);

				setTimeout(() => {
					cacheableRequest(opts, async response => {
						t.is(response.fromCache, false);

						const body = await getStream(response);
						t.is(body, 'hi');
						t.end();
					}).on('request', req => req.end());
				}, 100);
			});
	});
	/* eslint-enable max-nested-callbacks */
});

test.cb('cacheableRequest does not cache response if request is aborted after receiving part of the response', t => {
	/* eslint-disable max-nested-callbacks */
	// eslint-disable-next-line promise/prefer-await-to-then
	createTestServer().then(s => {
		s.get('/delay-partial', (req, res) => {
			res.setHeader('cache-control', 'max-age=60');
			res.write('h');
			setTimeout(() => {
				res.end('i');
			}, 50);
		});

		const cacheableRequest = new CacheableRequest(request);
		const opts = url.parse(s.url);
		opts.path = '/delay-partial';
		cacheableRequest(opts)
			.on('request', req => {
				req.end();

				setTimeout(() => {
					req.abort();
				}, 20);

				setTimeout(() => {
					cacheableRequest(opts, async response => {
						t.is(response.fromCache, false);

						const body = await getStream(response);
						t.is(body, 'hi');
						t.end();
					}).on('request', req => req.end());
				}, 100);
			});
	});
	/* eslint-enable max-nested-callbacks */
});

test.cb('cacheableRequest makes request even if initial DB connection fails (when opts.automaticFailover is enabled)', t => {
	const cacheableRequest = new CacheableRequest(request, 'sqlite://non/existent/database.sqlite');
	const opts = url.parse(s.url);
	opts.automaticFailover = true;
	cacheableRequest(opts, res => {
		t.is(res.statusCode, 200);
		t.end();
	})
		.on('error', () => {})
		.on('request', req => req.end());
});

test.cb('cacheableRequest makes request even if current DB connection fails (when opts.automaticFailover is enabled)', t => {
	/* eslint-disable unicorn/error-message */
	const cache = {
		get: () => {
			throw new Error();
		},
		set: () => {
			throw new Error();
		},
		delete: () => {
			throw new Error();
		}
	};
	/* eslint-enable unicorn/error-message */

	const cacheableRequest = new CacheableRequest(request, cache);
	const opts = url.parse(s.url);
	opts.automaticFailover = true;
	cacheableRequest(opts, res => {
		t.is(res.statusCode, 200);
		t.end();
	})
		.on('error', () => {})
		.on('request', req => req.end());
});

test.after('cleanup', async () => {
	await s.close();
});
