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
} & HookifiedOptions;

export class CacheableNet extends Hookified {
	private _cache: Cacheable = new Cacheable();

	constructor(options?: CacheableNetOptions) {
		super(options);

		if (options?.cache) {
			this._cache =
				options.cache instanceof Cacheable
					? options.cache
					: new Cacheable(options.cache);
		}
	}

	public get cache(): Cacheable {
		return this._cache;
	}

	public set cache(value: Cacheable) {
		this._cache = value;
	}

	/**
	 * Fetch data from a URL with optional request options. Will use the cache that is already set in the instance.
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
	 * Perform a POST request to a URL with optional request options. Will use the cache that is already set in the instance.
	 * @param {string} url The URL to fetch.
	 * @param {Omit<FetchRequestInit, 'method'>} options Optional request options (method will be set to POST).
	 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
	 */
	public async post<T = unknown>(
		url: string,
		options?: Omit<FetchRequestInit, "method">,
	): Promise<DataResponse<T>> {
		const response = await this.fetch(url, { ...options, method: "POST" });
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
}

export const Net = CacheableNet;
export {
	type DataResponse,
	type FetchOptions,
	type FetchRequestInit,
	fetch,
	type GetResponse,
	get,
	post,
	type Response as FetchResponse,
} from "./fetch.js";
