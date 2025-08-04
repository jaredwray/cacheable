import {type Cacheable, type CacheableOptions} from 'cacheable';
import {fetch as undiciFetch, type RequestInit, type Response as UndiciResponse} from 'undici';

export type FetchOptions = Omit<RequestInit, 'cache'> & {
	cache: Cacheable;
};

/**
 * Fetch data from a URL with optional request options.
 * @param {string} url The URL to fetch.
 * @param {FetchOptions} options Optional request options. The `cacheable` property is required and should be an
 * instance of `Cacheable` or a `CacheableOptions` object.
 * @returns {Promise<UndiciResponse>} The response from the fetch.
 */
export async function fetch(url: string, options: FetchOptions): Promise<UndiciResponse> {
	if (!options.cache) {
		throw new Error('Fetch options must include a cache instance or options.');
	}

	const fetchOptions: RequestInit = {
		...options,
		cache: 'no-cache',
	};

	return options.cache.getOrSet(url, async () => {
		// Perform the fetch operation
		const response = await undiciFetch(url, fetchOptions);
		if (!response.ok) {
			throw new Error(`Fetch failed with status ${response.status}`);
		}

		return response;
	}) as Promise<UndiciResponse>;
}

export type Response = UndiciResponse;
export type {RequestInit as FetchRequestInit} from 'undici';
