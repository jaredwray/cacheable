import { Cacheable, type CacheableOptions } from "cacheable";
import { Hookified, type HookifiedOptions } from "hookified";
import {
	type DataResponse,
	type FetchOptions,
	type Response as FetchResponse,
	fetch,
} from "./fetch.js";

export type NetFetchOptions = {
	/**
	 * Controls whether caching is enabled for this specific request.
	 * - `true`: Enable caching for this request
	 * - `false`: Disable caching for this request
	 * - `undefined`: Use default caching behavior based on the method (GET/HEAD are cached by default)
	 * @default undefined
	 */
	caching?: boolean;
	/**
	 * Custom function for converting JavaScript values to strings for this request.
	 * Overrides the instance-level stringify function if provided.
	 * @example
	 * // Use custom serialization for this request only
	 * stringify: (value) => superjson.stringify(value)
	 */
	stringify?: StringifyType;
	/**
	 * Custom function for parsing strings back to JavaScript values for this request.
	 * Overrides the instance-level parse function if provided.
	 * @example
	 * // Use custom parsing for this request only
	 * parse: (text) => superjson.parse(text)
	 */
	parse?: ParseType;
} & Omit<FetchOptions, "method" | "cache">;

export type CacheableNetOptions = {
	/**
	 * The cache instance or configuration options for caching responses.
	 * Can be either an existing Cacheable instance or options to create a new one.
	 * If not provided, a default Cacheable instance will be created.
	 * @default new Cacheable()
	 */
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
	httpCachePolicy?: boolean;
	/**
	 * Custom function for converting JavaScript values to strings.
	 * This is used when serializing request bodies for POST, PUT, PATCH, and DELETE methods.
	 * Useful for handling complex data types that JSON.stringify doesn't support natively.
	 * @default JSON.stringify
	 * @example
	 * // Using superjson for enhanced serialization
	 * stringify: (value) => superjson.stringify(value)
	 */
	stringify?: StringifyType;
	/**
	 * Custom function for parsing strings back to JavaScript values.
	 * This is used when deserializing response bodies.
	 * Should be compatible with the stringify function for proper round-trip serialization.
	 * @default JSON.parse
	 * @example
	 * // Using superjson for enhanced parsing
	 * parse: (text) => superjson.parse(text)
	 */
	parse?: ParseType;
} & HookifiedOptions;

/**
 * Function type for converting JavaScript values to strings.
 * Used for serializing request bodies and data.
 * @param value - The JavaScript value to stringify
 * @returns The string representation of the value
 */
export type StringifyType = (value: unknown) => string;

/**
 * Function type for parsing strings back to JavaScript values.
 * Used for deserializing response bodies.
 * @param value - The string to parse
 * @returns The parsed JavaScript value
 */
export type ParseType = (value: string) => unknown;

export class CacheableNet extends Hookified {
	private _cache: Cacheable = new Cacheable();
	private _httpCachePolicy = true;
	private _stringify: StringifyType = JSON.stringify;
	private _parse: ParseType = JSON.parse;

	constructor(options?: CacheableNetOptions) {
		super(options);

		if (options?.cache) {
			this._cache =
				options.cache instanceof Cacheable
					? options.cache
					: new Cacheable(options.cache);
		}

		if (options?.httpCachePolicy !== undefined) {
			this._httpCachePolicy = options.httpCachePolicy;
		}

		if (options?.stringify) {
			this._stringify = options?.stringify;
		}

		if (options?.parse) {
			this._parse = options?.parse;
		}
	}

	/**
	 * Get the stringify function used for converting objects to strings.
	 * @returns {StringifyType} The current stringify function
	 */
	public get stringify(): StringifyType {
		return this._stringify;
	}

	/**
	 * Set the stringify function for converting objects to strings.
	 * @param {StringifyType} value - The stringify function to use
	 */
	public set stringify(value: StringifyType) {
		this._stringify = value;
	}

	/**
	 * Get the parse function used for converting strings to objects.
	 * @returns {ParseType} The current parse function
	 */
	public get parse(): ParseType {
		return this._parse;
	}

	/**
	 * Set the parse function for converting strings to objects.
	 * @param {ParseType} value - The parse function to use
	 */
	public set parse(value: ParseType) {
		this._parse = value;
	}

	/**
	 * Get the Cacheable instance used for caching fetch operations.
	 * @returns {Cacheable} The current Cacheable instance
	 */
	public get cache(): Cacheable {
		return this._cache;
	}

	/**
	 * Set the Cacheable instance for caching fetch operations.
	 * @param {Cacheable} value - The Cacheable instance to use for caching
	 */
	public set cache(value: Cacheable) {
		this._cache = value;
	}

	/**
	 * Get the current HTTP cache policy setting.
	 * @returns {boolean} Whether HTTP cache semantics are enabled
	 */
	public get httpCachePolicy(): boolean {
		return this._httpCachePolicy;
	}

	/**
	 * Set whether to use HTTP cache semantics.
	 * @param {boolean} value - Enable or disable HTTP cache semantics
	 */
	public set httpCachePolicy(value: boolean) {
		this._httpCachePolicy = value;
	}

	/**
	 * Fetch data from a URL with optional request options. Will use the cache that is already set in the instance.
	 *
	 * When `httpCachePolicy` is enabled (default), cache entries will have their TTL
	 * set based on HTTP cache headers (e.g., Cache-Control: max-age). When disabled,
	 * the default TTL from the Cacheable instance is used.
	 *
	 * @param {string} url The URL to fetch.
	 * @param {Omit<FetchOptions, "cache">} options Optional request options.
	 * @returns {Promise<FetchResponse>} The response from the fetch.
	 */
	public async fetch(
		url: string,
		options?: Omit<FetchOptions, "cache">,
	): Promise<FetchResponse> {
		const fetchOptions: FetchOptions = {
			...options,
			cache: this._cache,
			httpCachePolicy: this._httpCachePolicy,
		};

		return fetch(url, fetchOptions);
	}

	/**
	 * Perform a GET request to a URL with optional request options. By default caching is enabled on all requests. To
	 * disable set `options.caching` to false.
	 * @param {string} url The URL to fetch.
	 * @param {NetFetchOptions} options Optional request options (method will be set to GET).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async get<T = unknown>(
		url: string,
		options?: NetFetchOptions,
	): Promise<DataResponse<T>> {
		const fetchOptions: FetchOptions = {
			...options,
			cache: this._cache,
			httpCachePolicy: this._httpCachePolicy,
			method: "GET",
		};

		// remove cache if they specify it
		if (options?.caching !== undefined) {
			delete fetchOptions.cache;
		}

		const response = await fetch(url, fetchOptions);

		const text = await response.text();
		let data: T;

		// Use custom parse function if provided, otherwise use instance parse
		const parseFn = options?.parse || this._parse;

		try {
			data = parseFn(text) as T;
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
	 * Perform a POST request to a URL with data and optional request options. By default caching is not enabled. To enable it
	 * set `options.caching` to true. Note, setting caching to tru means it will not post if the data is the same.
	 * @param {string} url The URL to fetch.
	 * @param {unknown} data The data to send in the request body.
	 * @param {Omit<NetFetchOptions, "method" | "body" >} options Optional request options (method and body will be set).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async post<T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<NetFetchOptions, "method" | "body">,
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
			// Use custom stringify function if provided, otherwise use instance stringify
			const stringifyFn = options?.stringify || this._stringify;
			body = stringifyFn(data);
			// Set Content-Type to JSON if not already set
			if (!headers["Content-Type"] && !headers["content-type"]) {
				headers["Content-Type"] = "application/json";
			}
		}

		const fetchOptions: FetchOptions = {
			...options,
			headers,
			body: body as FetchOptions["body"],
			httpCachePolicy: this._httpCachePolicy,
			method: "POST",
		};

		// add the cache if caching is true
		if (options?.caching === true) {
			fetchOptions.cache = this._cache;
		}

		const response = await fetch(url, fetchOptions);
		const text = await response.text();
		let responseData: T;

		// Use custom parse function if provided, otherwise use instance parse
		const parseFn = options?.parse || this._parse;

		try {
			responseData = parseFn(text) as T;
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
	 * Perform a HEAD request to a URL with optional request options. By default caching is enabled on all requests. To
	 * disable set `options.caching` to false.
	 * @param {string} url The URL to fetch.
	 * @param {NetFetchOptions} options Optional request options (method will be set to HEAD).
	 * @returns {Promise<FetchResponse>} The response from the fetch (no body).
	 */
	public async head(
		url: string,
		options?: NetFetchOptions,
	): Promise<FetchResponse> {
		const fetchOptions: FetchOptions = {
			...options,
			cache: this._cache,
			httpCachePolicy: this._httpCachePolicy,
			method: "HEAD",
		};

		// remove cache if they specify it
		if (options?.caching !== undefined && !options.caching) {
			delete fetchOptions.cache;
		}

		const response = await fetch(url, fetchOptions);
		return response;
	}

	/**
	 * Perform a PUT request to a URL with data and optional request options. By default caching is not enabled. To enable it
	 * set `options.caching` to true. Note, setting caching to true means it will not put if the data is the same.
	 * @param {string} url The URL to fetch.
	 * @param {unknown} data The data to send in the request body.
	 * @param {Omit<NetFetchOptions, 'method' | 'body'>} options Optional request options (method and body will be set).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async put<T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<NetFetchOptions, "method" | "body">,
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
			// Use custom stringify function if provided, otherwise use instance stringify
			const stringifyFn = options?.stringify || this._stringify;
			body = stringifyFn(data);
			// Set Content-Type to JSON if not already set
			if (!headers["Content-Type"] && !headers["content-type"]) {
				headers["Content-Type"] = "application/json";
			}
		}

		const fetchOptions: FetchOptions = {
			...options,
			headers,
			body: body as FetchOptions["body"],
			httpCachePolicy: this._httpCachePolicy,
			method: "PUT",
		};

		// add the cache if caching is true
		if (options?.caching === true) {
			fetchOptions.cache = this._cache;
		}

		const response = await fetch(url, fetchOptions);
		const text = await response.text();
		let responseData: T;

		// Use custom parse function if provided, otherwise use instance parse
		const parseFn = options?.parse || this._parse;

		try {
			responseData = parseFn(text) as T;
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
	 * Perform a PATCH request to a URL with data and optional request options. By default caching is not enabled. To enable it
	 * set `options.caching` to true. Note, setting caching to true means it will not patch if the data is the same.
	 * @param {string} url The URL to fetch.
	 * @param {unknown} data The data to send in the request body.
	 * @param {Omit<NetFetchOptions, 'method' | 'body'>} options Optional request options (method and body will be set).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async patch<T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<NetFetchOptions, "method" | "body">,
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
			// Use custom stringify function if provided, otherwise use instance stringify
			const stringifyFn = options?.stringify || this._stringify;
			body = stringifyFn(data);
			// Set Content-Type to JSON if not already set
			if (!headers["Content-Type"] && !headers["content-type"]) {
				headers["Content-Type"] = "application/json";
			}
		}

		const fetchOptions: FetchOptions = {
			...options,
			headers,
			body: body as FetchOptions["body"],
			httpCachePolicy: this._httpCachePolicy,
			method: "PATCH",
		};

		// add the cache if caching is true
		if (options?.caching === true) {
			fetchOptions.cache = this._cache;
		}

		const response = await fetch(url, fetchOptions);
		const text = await response.text();
		let responseData: T;

		// Use custom parse function if provided, otherwise use instance parse
		const parseFn = options?.parse || this._parse;

		try {
			responseData = parseFn(text) as T;
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
	 * Perform a DELETE request to a URL with optional data and request options. By default caching is not enabled. To enable it
	 * set `options.caching` to true. Note, setting caching to true means it will not delete if the data is the same.
	 * @param {string} url The URL to fetch.
	 * @param {unknown} data Optional data to send in the request body.
	 * @param {Omit<NetFetchOptions, 'method' | 'body'>} options Optional request options (method and body will be set).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async delete<T = unknown>(
		url: string,
		data?: unknown,
		options?: Omit<NetFetchOptions, "method" | "body">,
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
				// Use custom stringify function if provided, otherwise use instance stringify
				const stringifyFn = options?.stringify || this._stringify;
				body = stringifyFn(data);
				// Set Content-Type to JSON if not already set
				if (!headers["Content-Type"] && !headers["content-type"]) {
					headers["Content-Type"] = "application/json";
				}
			}
		}

		const fetchOptions: FetchOptions = {
			...options,
			headers,
			body: body as FetchOptions["body"],
			httpCachePolicy: this._httpCachePolicy,
			method: "DELETE",
		};

		// add the cache if caching is true
		if (options?.caching === true) {
			fetchOptions.cache = this._cache;
		}

		const response = await fetch(url, fetchOptions);
		const text = await response.text();
		let responseData: T;

		// Use custom parse function if provided, otherwise use instance parse
		const parseFn = options?.parse || this._parse;

		try {
			responseData = parseFn(text) as T;
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
	fetch,
	type GetResponse,
	get,
	head,
	patch,
	post,
	type Response as FetchResponse,
} from "./fetch.js";
