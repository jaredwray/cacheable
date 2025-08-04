import {type Cacheable, type CacheableOptions} from 'cacheable';
import {fetch as undiciFetch, type RequestInit, type Response as UndiciResponse} from 'undici';

export type FetchOptions = RequestInit & {
	cacheable: Cacheable | CacheableOptions;
};

/**
 * Fetch data from a URL with optional request options.
 * @param {string} url The URL to fetch.
 * @param {FetchOptions} options Optional request options. The `cacheable` property is required and should be an
 * instance of `Cacheable` or a `CacheableOptions` object.
 * @returns {Promise<UndiciResponse>} The response from the fetch.
 */
export async function fetch(url: string, options?: FetchOptions): Promise<UndiciResponse> {
	return undiciFetch(url, options);
}

export type Response = UndiciResponse;
export type {RequestInit as FetchRequestInit} from 'undici';
