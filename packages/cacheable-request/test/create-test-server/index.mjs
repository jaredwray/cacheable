/* eslint-disable */
'use strict';

import http from 'node:http';
import express from 'express';
import pify from 'pify';
import bodyParser from 'body-parser';

const createTestServer = (opts = {}) => {
		const server = express();
		server.http = http.createServer(server);
		
		server.set('etag', false);

		if (opts.bodyParser !== false) {
			server.use(bodyParser.json(Object.assign({ limit: '1mb', type: 'application/json' }, opts.bodyParser)));
			server.use(bodyParser.text(Object.assign({ limit: '1mb', type: 'text/plain' }, opts.bodyParser)));
			server.use(bodyParser.urlencoded(Object.assign({ limit: '1mb', type: 'application/x-www-form-urlencoded', extended: true }, opts.bodyParser)));
			server.use(bodyParser.raw(Object.assign({ limit: '1mb', type: 'application/octet-stream' }, opts.bodyParser)));
		}

		const send = fn => (req, res, next) => {
			const cb = typeof fn === 'function' ? fn(req, res, next) : fn;

			Promise.resolve(cb).then(val => {
				if (val) {
					/* c8 ignore next 3 */
					res.send(val);
				}
			});
		};

		const get = server.get.bind(server);
		server.get = function () {
			const [path, ...handlers] = [...arguments];

			for (const handler of handlers) {
				get(path, send(handler));
			}
		};

		server.listen = () => Promise.all([
			pify(server.http.listen.bind(server.http))().then(() => {
				server.port = server.http.address().port;
				server.url = `http://localhost:${server.port}`;
			})
		]);

		server.close = () => Promise.all([
			pify(server.http.close.bind(server.http))().then(() => {
				server.port = undefined;
				server.url = undefined;
			})
		]);

		return server.listen().then(() => server);
	};

export default createTestServer;