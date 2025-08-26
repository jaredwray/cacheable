import type { Cacheable } from "cacheable";
import {
	type RequestInit,
	type Response as UndiciResponse,
	fetch as undiciFetch,
} from "undici";

export type FetchOptions = Omit<RequestInit, "cache"> & {
	cache: Cacheable;
};

/**
 * Fetch data from a URL with optional request options.
 * @param {string} url The URL to fetch.
 * @param {FetchOptions} options Optional request options. The `cacheable` property is required and should be an
 * instance of `Cacheable` or a `CacheableOptions` object.
 * @returns {Promise<UndiciResponse>} The response from the fetch.
 */
export async function fetch(
	url: string,
	options: FetchOptions,
): Promise<UndiciResponse> {
	if (!options.cache) {
		throw new Error("Fetch options must include a cache instance or options.");
	}

	const fetchOptions: RequestInit = {
		...options,
		cache: "no-cache",
	};

	// Create a cache key that includes the method
	const cacheKey = `${options.method || "GET"}:${url}`;

	const cachedData = await options.cache.getOrSet(cacheKey, async () => {
		// Perform the fetch operation
		const response = await undiciFetch(url, fetchOptions);
		/* c8 ignore next 3 */
		if (!response.ok) {
			throw new Error(`Fetch failed with status ${response.status}`);
		}

		// Convert response to cacheable format
		const body = await response.text();
		return {
			body,
			status: response.status,
			statusText: response.statusText,
			headers: Object.fromEntries(response.headers.entries()),
		};
	});

	// Reconstruct Response object from cached data
	/* c8 ignore next 3 */
	if (!cachedData) {
		throw new Error("Failed to get or set cache data");
	}

	return new Response(cachedData.body, {
		status: cachedData.status,
		statusText: cachedData.statusText,
		headers: cachedData.headers,
	}) as UndiciResponse;
}

export type Response = UndiciResponse;
export type { RequestInit as FetchRequestInit } from "undici";
