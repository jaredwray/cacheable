import { Cacheable, type CacheableOptions } from "cacheable";
import { Hookified, type HookifiedOptions } from "hookified";
import {
	type DataResponse,
	type FetchOptions,
	type FetchRequestInit,
	type Response as FetchResponse,
	fetch,
} from "./fetch.js";

export type CacheableNetOptions = {
	cache?: Cacheable | CacheableOptions;
	/**
	 * Enable HTTP cache semantics for intelligent response caching.
	 *
	 * When enabled (default), fetch operations will:
	 * - Respect standard HTTP cache headers (Cache-Control, ETag, Last-Modified, Expires)
	 * - Store and validate cache policies according to RFC 7234
	 * - Handle conditional requests with If-None-Match and If-Modified-Since headers
	 * - Process 304 Not Modified responses to update cached entries
	 * - Only cache responses that are considered "storable" per HTTP specifications
	 * - Automatically revalidate stale cache entries when needed
	 * - **Set cache TTL based on HTTP headers (e.g., max-age directive)**
	 * - Refresh TTL when receiving 304 Not Modified responses
	 *
	 * When disabled, fetch operations will:
	 * - Use simple key-based caching without considering HTTP headers
	 * - Cache all successful GET responses regardless of cache directives
	 * - Never revalidate cached entries
	 * - Ignore cache-control directives from the server
	 * - **Use the default TTL from the Cacheable instance**
	 *
	 * @default true
	 */
	useHttpCache?: boolean;
} & HookifiedOptions;

export class CacheableNet extends Hookified {
	private _cache: Cacheable = new Cacheable();
	private _useHttpCache = true;

	constructor(options?: CacheableNetOptions) {
		super(options);

		if (options?.cache) {
			this._cache =
				options.cache instanceof Cacheable
					? options.cache
					: new Cacheable(options.cache);
		}

		if (options?.useHttpCache !== undefined) {
			this._useHttpCache = options.useHttpCache;
		}
	}

	public get cache(): Cacheable {
		return this._cache;
	}

	public set cache(value: Cacheable) {
		this._cache = value;
	}

	/**
	 * Get the current HTTP cache setting.
	 * @returns {boolean} Whether HTTP cache semantics are enabled
	 */
	public get useHttpCache(): boolean {
		return this._useHttpCache;
	}

	/**
	 * Set whether to use HTTP cache semantics.
	 * @param {boolean} value - Enable or disable HTTP cache semantics
	 */
	public set useHttpCache(value: boolean) {
		this._useHttpCache = value;
	}

	/**
	 * Fetch data from a URL with optional request options. Will use the cache that is already set in the instance.
	 *
	 * When `useHttpCache` is enabled (default), cache entries will have their TTL
	 * set based on HTTP cache headers (e.g., Cache-Control: max-age). When disabled,
	 * the default TTL from the Cacheable instance is used.
	 *
	 * @param {string} url The URL to fetch.
	 * @param {FetchRequestInit} options Optional request options.
	 * @returns {Promise<FetchResponse>} The response from the fetch.
	 */
	public async fetch(
		url: string,
		options?: FetchRequestInit,
	): Promise<FetchResponse> {
		const fetchOptions: FetchOptions = {
			...options,
			cache: this._cache,
			useHttpCache: this._useHttpCache,
		};

		return fetch(url, fetchOptions);
	}

	/**
	 * Perform a GET request to a URL with optional request options. Will use the cache that is already set in the instance.
	 * @param {string} url The URL to fetch.
	 * @param {Omit<FetchRequestInit, 'method'>} options Optional request options (method will be set to GET).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async get<T = unknown>(
		url: string,
		options?: Omit<FetchRequestInit, "method">,
	): Promise<DataResponse<T>> {
		const response = await this.fetch(url, { ...options, method: "GET" });
		const text = await response.text();
		let data: T;

		try {
			data = JSON.parse(text) as T;
		} catch {
			// If not JSON, return as is
			data = text as T;
		}

		// Create a new response with the text already consumed
		const newResponse = new Response(text, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers as HeadersInit,
		}) as FetchResponse;

		return {
			data,
			response: newResponse,
		};
	}

	/**
	 * Perform a POST request to a URL with data and optional request options. Will use the cache that is already set in the instance.
	 * @param {string} url The URL to fetch.
	 * @param {unknown} data The data to send in the request body.
	 * @param {Omit<FetchRequestInit, 'method' | 'body'>} options Optional request options (method and body will be set).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async post<T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<FetchRequestInit, "method" | "body">,
	): Promise<DataResponse<T>> {
		// Automatically stringify data if it's an object and set appropriate headers
		let body: BodyInit | undefined;
		const headers = { ...options?.headers } as Record<string, string>;

		if (typeof data === "string") {
			body = data;
		} else if (
			data instanceof FormData ||
			data instanceof URLSearchParams ||
			data instanceof Blob
		) {
			body = data as BodyInit;
		} else {
			// Assume it's JSON data
			body = JSON.stringify(data);
			// Set Content-Type to JSON if not already set
			if (!headers["Content-Type"] && !headers["content-type"]) {
				headers["Content-Type"] = "application/json";
			}
		}

		const response = await this.fetch(url, {
			...options,
			headers,
			body: body as FetchRequestInit["body"],
			method: "POST",
		});
		const text = await response.text();
		let responseData: T;

		try {
			responseData = JSON.parse(text) as T;
		} catch {
			// If not JSON, return as is
			responseData = text as T;
		}

		// Create a new response with the text already consumed
		const newResponse = new Response(text, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers as HeadersInit,
		}) as FetchResponse;

		return {
			data: responseData,
			response: newResponse,
		};
	}

	/**
	 * Perform a HEAD request to a URL with optional request options. Will use the cache that is already set in the instance.
	 * @param {string} url The URL to fetch.
	 * @param {Omit<FetchRequestInit, 'method'>} options Optional request options (method will be set to HEAD).
	 * @returns {Promise<FetchResponse>} The response from the fetch (no body).
	 */
	public async head(
		url: string,
		options?: Omit<FetchRequestInit, "method">,
	): Promise<FetchResponse> {
		const response = await this.fetch(url, { ...options, method: "HEAD" });
		return response;
	}

	/**
	 * Perform a PATCH request to a URL with data and optional request options. Will use the cache that is already set in the instance.
	 * @param {string} url The URL to fetch.
	 * @param {unknown} data The data to send in the request body.
	 * @param {Omit<FetchRequestInit, 'method' | 'body'>} options Optional request options (method and body will be set).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async patch<T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<FetchRequestInit, "method" | "body">,
	): Promise<DataResponse<T>> {
		// Automatically stringify data if it's an object and set appropriate headers
		let body: BodyInit | undefined;
		const headers = { ...options?.headers } as Record<string, string>;

		if (typeof data === "string") {
			body = data;
		} else if (
			data instanceof FormData ||
			data instanceof URLSearchParams ||
			data instanceof Blob
		) {
			body = data as BodyInit;
		} else {
			// Assume it's JSON data
			body = JSON.stringify(data);
			// Set Content-Type to JSON if not already set
			if (!headers["Content-Type"] && !headers["content-type"]) {
				headers["Content-Type"] = "application/json";
			}
		}

		const response = await this.fetch(url, {
			...options,
			headers,
			body: body as FetchRequestInit["body"],
			method: "PATCH",
		});
		const text = await response.text();
		let responseData: T;

		try {
			responseData = JSON.parse(text) as T;
		} catch {
			// If not JSON, return as is
			responseData = text as T;
		}

		// Create a new response with the text already consumed
		const newResponse = new Response(text, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers as HeadersInit,
		}) as FetchResponse;

		return {
			data: responseData,
			response: newResponse,
		};
	}

	/**
	 * Perform a DELETE request to a URL with optional data and request options. Will use the cache that is already set in the instance.
	 * @param {string} url The URL to fetch.
	 * @param {unknown} data Optional data to send in the request body.
	 * @param {Omit<FetchRequestInit, 'method' | 'body'>} options Optional request options (method and body will be set).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async delete<T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<FetchRequestInit, "method" | "body">,
	): Promise<DataResponse<T>> {
		// Automatically stringify data if it's provided and set appropriate headers
		let body: BodyInit | undefined;
		const headers = { ...options?.headers } as Record<string, string>;

		if (data !== undefined) {
			if (typeof data === "string") {
				body = data;
			} else if (
				data instanceof FormData ||
				data instanceof URLSearchParams ||
				data instanceof Blob
			) {
				body = data as BodyInit;
			} else {
				// Assume it's JSON data
				body = JSON.stringify(data);
				// Set Content-Type to JSON if not already set
				if (!headers["Content-Type"] && !headers["content-type"]) {
					headers["Content-Type"] = "application/json";
				}
			}
		}

		const response = await this.fetch(url, {
			...options,
			headers,
			body: body as FetchRequestInit["body"],
			method: "DELETE",
		});
		const text = await response.text();
		let responseData: T;

		try {
			responseData = JSON.parse(text) as T;
		} catch {
			// If not JSON, return as is
			responseData = text as T;
		}

		// Create a new response with the text already consumed
		const newResponse = new Response(text, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers as HeadersInit,
		}) as FetchResponse;

		return {
			data: responseData,
			response: newResponse,
		};
	}
}

export const Net = CacheableNet;
export {
	type DataResponse,
	del,
	type FetchOptions,
	type FetchRequestInit,
	fetch,
	type GetResponse,
	get,
	head,
	patch,
	post,
	type Response as FetchResponse,
} from "./fetch.js";
