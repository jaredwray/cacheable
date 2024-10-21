import EventEmitter from 'node:events';
import urlLib from 'node:url';
import crypto from 'node:crypto';
import stream, {PassThrough as PassThroughStream} from 'node:stream';
import {IncomingMessage} from 'node:http';
import process from 'node:process';
import normalizeUrl from 'normalize-url';
import {getStreamAsBuffer} from 'get-stream';
import CachePolicy from 'http-cache-semantics';
import Response from 'responselike';
import {Keyv} from 'keyv';
import mimicResponse from 'mimic-response';
import {
	RequestFn, CacheResponse, CacheValue, CacheableOptions, UrlOption, CacheError, RequestError, Emitter, CacheableRequestFunction,
} from './types.js';

// eslint-disable-next-line @typescript-eslint/naming-convention
type Function_ = (...arguments_: any[]) => any;

class CacheableRequest {
	cache: Keyv = new Keyv<any>({namespace: 'cacheable-request'});
	cacheRequest: RequestFn;
	hooks: Map<string, Function_> = new Map<string, Function_>();
	constructor(cacheRequest: RequestFn, cacheAdapter?: any) {
		if (cacheAdapter) {
			if (cacheAdapter instanceof Keyv) {
				this.cache = cacheAdapter;
			} else {
				this.cache = new Keyv({
					store: cacheAdapter,
					namespace: 'cacheable-request',
				});
			}
		}

		this.request = this.request.bind(this);
		this.cacheRequest = cacheRequest;
	}

	request = () => (options: CacheableOptions,
		callback?: (response: CacheResponse) => void): Emitter => {
		let url;
		if (typeof options === 'string') {
			url = normalizeUrlObject(urlLib.parse(options));
			options = {};
		} else if (options instanceof urlLib.URL) {
			url = normalizeUrlObject(urlLib.parse(options.toString()));
			options = {};
		} else {
			const [pathname, ...searchParts] = (options.path ?? '').split('?');
			const search = searchParts.length > 0
				? `?${searchParts.join('?')}`
				: '';
			url = normalizeUrlObject({...options, pathname, search});
		}

		options = {
			headers: {},
			method: 'GET',
			cache: true,
			strictTtl: false,
			automaticFailover: false,
			...options,
			...urlObjectToRequestOptions(url),
		};
		options.headers = Object.fromEntries(entries(options.headers).map(([key, value]) => [(key as string).toLowerCase(), value]));
		const ee: Emitter = new EventEmitter() as Emitter;
		const normalizedUrlString = normalizeUrl(urlLib.format(url), {
			stripWWW: false, // eslint-disable-line @typescript-eslint/naming-convention
			removeTrailingSlash: false,
			stripAuthentication: false,
		});
		let key = `${options.method}:${normalizedUrlString}`;
		// POST, PATCH, and PUT requests may be cached, depending on the response
		// cache-control headers. As a result, the body of the request should be
		// added to the cache key in order to avoid collisions.
		if (options.body && options.method !== undefined && ['POST', 'PATCH', 'PUT'].includes(options.method)) {
			if (options.body instanceof stream.Readable) {
				// Streamed bodies should completely skip the cache because they may
				// or may not be hashable and in either case the stream would need to
				// close before the cache key could be generated.
				options.cache = false;
			} else {
				key += `:${crypto.createHash('md5').update(options.body).digest('hex')}`;
			}
		}

		let revalidate: any = false;
		let madeRequest = false;
		const makeRequest = (options_: any) => {
			madeRequest = true;
			let requestErrored = false;
			let requestErrorCallback: (...arguments_: any[]) => void = () => {/* do nothing */};

			const requestErrorPromise = new Promise<void>(resolve => {
				requestErrorCallback = () => {
					if (!requestErrored) {
						requestErrored = true;
						resolve();
					}
				};
			});
			const handler = async (response: any) => {
				if (revalidate) {
					response.status = response.statusCode;
					const revalidatedPolicy = CachePolicy.fromObject(revalidate.cachePolicy).revalidatedPolicy(options_, response);
					if (!revalidatedPolicy.modified) {
						response.resume();
						await new Promise(resolve => {
							// Skipping 'error' handler cause 'error' event should't be emitted for 304 response
							response
								.once('end', resolve);
						});
						const headers = convertHeaders(revalidatedPolicy.policy.responseHeaders());
						response = new Response({
							statusCode: revalidate.statusCode, headers, body: revalidate.body, url: revalidate.url,
						});
						response.cachePolicy = revalidatedPolicy.policy;
						response.fromCache = true;
					}
				}

				if (!response.fromCache) {
					response.cachePolicy = new CachePolicy(options_, response, options_);
					response.fromCache = false;
				}

				let clonedResponse;
				if (options_.cache && response.cachePolicy.storable()) {
					clonedResponse = cloneResponse(response);
					(async () => {
						try {
							const bodyPromise = getStreamAsBuffer(response);
							await Promise.race([
								requestErrorPromise,
								new Promise(resolve => response.once('end', resolve)), // eslint-disable-line no-promise-executor-return
								new Promise(resolve => response.once('close', resolve)), // eslint-disable-line no-promise-executor-return
							]);
							const body = await bodyPromise;
							let value: CacheValue = {
								url: response.url,
								statusCode: response.fromCache ? revalidate.statusCode : response.statusCode,
								body,
								cachePolicy: response.cachePolicy.toObject(),
							};
							let ttl = options_.strictTtl ? response.cachePolicy.timeToLive() : undefined;
							if (options_.maxTtl) {
								ttl = ttl ? Math.min(ttl, options_.maxTtl) : options_.maxTtl;
							}

							if (this.hooks.size > 0) {
								/* eslint-disable no-await-in-loop */
								for (const key_ of this.hooks.keys()) {
									value = await this.runHook(key_, value, response);
								}
								/* eslint-enable no-await-in-loop */
							}

							await this.cache.set(key, value, ttl);
						} catch (error: any) {
							/* c8 ignore next 2 */
							ee.emit('error', new CacheError(error));
						}
					})();
				} else if (options_.cache && revalidate) {
					(async () => {
						try {
							await this.cache.delete(key);
						} catch (error: any) {
							/* c8 ignore next 2 */
							ee.emit('error', new CacheError(error));
						}
					})();
				}

				ee.emit('response', clonedResponse ?? response);
				if (typeof callback === 'function') {
					callback(clonedResponse ?? response);
				}
			};

			try {
				const request_ = this.cacheRequest(options_, handler);
				request_.once('error', requestErrorCallback);
				request_.once('abort', requestErrorCallback);
				request_.once('destroy', requestErrorCallback);
				ee.emit('request', request_);
			} catch (error: any) {
				ee.emit('error', new RequestError(error));
			}
		};

		(async () => {
			const get = async (options_: any) => {
				await Promise.resolve();
				const cacheEntry = options_.cache ? await this.cache.get(key) : undefined;

				if (cacheEntry === undefined && !options_.forceRefresh) {
					makeRequest(options_);
					return;
				}

				const policy = CachePolicy.fromObject((cacheEntry as CacheValue).cachePolicy);
				if (policy.satisfiesWithoutRevalidation(options_) && !options_.forceRefresh) {
					const headers = convertHeaders(policy.responseHeaders());
					const response: any = new Response({
						statusCode: (cacheEntry as CacheValue).statusCode, headers, body: Buffer.from((cacheEntry as CacheValue).body), url: (cacheEntry as CacheValue).url,
					});
					response.cachePolicy = policy;
					response.fromCache = true;
					ee.emit('response', response);
					if (typeof callback === 'function') {
						callback(response);
					}
				} else if (policy.satisfiesWithoutRevalidation(options_) && Date.now() >= policy.timeToLive() && options_.forceRefresh) {
					await this.cache.delete(key);
					options_.headers = policy.revalidationHeaders(options_);
					makeRequest(options_);
				} else {
					revalidate = cacheEntry;
					options_.headers = policy.revalidationHeaders(options_);
					makeRequest(options_);
				}
			};

			const errorHandler = (error: Error) => ee.emit('error', new CacheError(error));
			if (this.cache instanceof Keyv) {
				const cachek = this.cache;
				cachek.once('error', errorHandler);
				ee.on('error', () => {
					cachek.removeListener('error', errorHandler);
				});
				ee.on('response', () => {
					cachek.removeListener('error', errorHandler);
				});
			}

			try {
				await get(options);
			} catch (error: any) {
				if (options.automaticFailover && !madeRequest) {
					makeRequest(options);
				}

				ee.emit('error', new CacheError(error));
			}
		})();

		return ee;
	};

	addHook = (name: string, function_: Function_) => {
		if (!this.hooks.has(name)) {
			this.hooks.set(name, function_);
		}
	};

	removeHook = (name: string) => this.hooks.delete(name);

	getHook = (name: string) => this.hooks.get(name);

	runHook = async (name: string, ...arguments_: any[]): Promise<CacheValue> => this.hooks.get(name)?.(...arguments_);
}

const entries = Object.entries as <T>(object: T) => Array<[keyof T, T[keyof T]]>;

const cloneResponse = (response: IncomingMessage) => {
	const clone = new PassThroughStream({autoDestroy: false});
	mimicResponse(response, clone);

	return response.pipe(clone);
};

const urlObjectToRequestOptions = (url: any) => {
	const options: UrlOption = {...url};
	options.path = `${url.pathname || '/'}${url.search || ''}`;
	delete options.pathname;
	delete options.search;
	return options;
};

const normalizeUrlObject = (url: any) =>
	// If url was parsed by url.parse or new URL:
	// - hostname will be set
	// - host will be hostname[:port]
	// - port will be set if it was explicit in the parsed string
	// Otherwise, url was from request options:
	// - hostname or host may be set
	// - host shall not have port encoded
	({
		protocol: url.protocol,
		auth: url.auth,
		hostname: url.hostname || url.host || 'localhost',
		port: url.port,
		pathname: url.pathname,
		search: url.search,
	});

const convertHeaders = (headers: CachePolicy.Headers) => {
	const result: any = [];
	for (const name of Object.keys(headers)) {
		result[name.toLowerCase()] = headers[name];
	}

	return result;
};

export default CacheableRequest;
export * from './types.js';
export const onResponse = 'onResponse';
