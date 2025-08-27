import type { Cacheable } from "cacheable";
import CachePolicy from "http-cache-semantics";
import {
	type RequestInit,
	type Response as UndiciResponse,
	fetch as undiciFetch,
} from "undici";

export type FetchOptions = Omit<RequestInit, "cache"> & {
	cache: Cacheable;
	/**
	 * Enable HTTP cache semantics for intelligent response caching.
	 *
	 * When enabled (default), the fetch function will:
	 * - Respect standard HTTP cache headers (Cache-Control, ETag, Last-Modified, Expires)
	 * - Store and validate cache policies according to RFC 7234
	 * - Handle conditional requests with If-None-Match and If-Modified-Since headers
	 * - Process 304 Not Modified responses to update cached entries
	 * - Only cache responses that are considered "storable" per HTTP specifications
	 * - Automatically revalidate stale cache entries when needed
	 * - **Set cache TTL based on HTTP headers (e.g., max-age directive)**
	 * - Refresh TTL when receiving 304 Not Modified responses
	 *
	 * When disabled, the fetch function will:
	 * - Use simple key-based caching without considering HTTP headers
	 * - Cache all successful GET responses regardless of cache directives
	 * - Never revalidate cached entries
	 * - Ignore cache-control directives from the server
	 * - **Use the default TTL from the Cacheable instance**
	 *
	 * @default true
	 */
	useHttpCache?: boolean;
};

/**
 * Fetch data from a URL with optional request options.
 *
 * When `useHttpCache` is enabled (default), cache entries will have their TTL
 * set based on HTTP cache headers (e.g., Cache-Control: max-age). When disabled,
 * the default TTL from the Cacheable instance is used.
 *
 * @param {string} url The URL to fetch.
 * @param {FetchOptions} options Optional request options. The `cache` property is required.
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

	// Skip caching for POST, PATCH, DELETE, and HEAD requests
	if (
		options.method === "POST" ||
		options.method === "PATCH" ||
		options.method === "DELETE" ||
		options.method === "HEAD"
	) {
		const response = await undiciFetch(url, fetchOptions);
		/* c8 ignore next 3 */
		if (!response.ok) {
			throw new Error(`Fetch failed with status ${response.status}`);
		}
		return response;
	}

	const useHttpCache = options.useHttpCache !== false; // Default to true
	const method = options.method || "GET";

	// Create a cache key that includes the method
	const cacheKey = `${method}:${url}`;

	if (!useHttpCache) {
		// Simple caching without HTTP cache semantics
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

	// HTTP cache semantics enabled
	const policyKey = `${cacheKey}:policy`;

	type CachedResponse = {
		body: string;
		status: number;
		statusText: string;
		headers: Record<string, string>;
	};

	// Try to get cached response and policy
	const [cachedResponse, cachedPolicyData] = await Promise.all([
		options.cache.get<CachedResponse>(cacheKey),
		options.cache.get(policyKey),
	]);

	let policy: CachePolicy | undefined;
	let cachedBody: string | undefined;
	let cachedStatus: number | undefined;
	let cachedStatusText: string | undefined;
	let cachedHeaders: Record<string, string> | undefined;

	if (cachedPolicyData && cachedResponse) {
		// Deserialize the policy
		policy = CachePolicy.fromObject(
			cachedPolicyData as CachePolicy.CachePolicyObject,
		);
		cachedBody = cachedResponse.body;
		cachedStatus = cachedResponse.status;
		cachedStatusText = cachedResponse.statusText;
		cachedHeaders = cachedResponse.headers;
	}

	// Prepare the request for http-cache-semantics
	const requestHeaders = fetchOptions.headers || {};
	const request = {
		url,
		method,
		headers: requestHeaders as Record<string, string>,
	};

	// Check if we have a valid cached response
	if (policy?.satisfiesWithoutRevalidation(request)) {
		// Return cached response with updated headers
		const headers = policy.responseHeaders();
		return new Response(cachedBody, {
			status: cachedStatus,
			statusText: cachedStatusText,
			headers: headers as HeadersInit,
		}) as UndiciResponse;
	}

	// Check if we need revalidation
	let revalidationHeaders = {};
	if (policy?.revalidationHeaders(request)) {
		revalidationHeaders = policy.revalidationHeaders(request);
	}

	// Make the fetch request
	const response = await undiciFetch(url, {
		...fetchOptions,
		headers: {
			...fetchOptions.headers,
			...revalidationHeaders,
		},
	});

	// Handle 304 Not Modified
	if (response.status === 304 && policy) {
		// Update the policy with the revalidation response
		const { policy: updatedPolicy, modified } = policy.revalidatedPolicy(
			request,
			{
				status: response.status,
				headers: Object.fromEntries(response.headers.entries()),
			},
		);

		if (!modified) {
			// Calculate new TTL from updated policy
			const ttl = updatedPolicy.timeToLive();

			// Store updated policy with new TTL
			await options.cache.set(policyKey, updatedPolicy.toObject(), ttl);

			// Also refresh the cached response TTL
			await options.cache.set(
				cacheKey,
				{
					body: cachedBody,
					status: cachedStatus,
					statusText: cachedStatusText,
					headers: cachedHeaders,
				},
				ttl,
			);

			// Return cached response with updated headers
			const headers = updatedPolicy.responseHeaders();
			return new Response(cachedBody, {
				status: cachedStatus,
				statusText: cachedStatusText,
				headers: headers as HeadersInit,
			}) as UndiciResponse;
		}
	}

	/* c8 ignore next 3 */
	if (!response.ok && response.status !== 304) {
		throw new Error(`Fetch failed with status ${response.status}`);
	}

	// Read the response body
	const body = await response.text();

	// Create response object for http-cache-semantics
	const responseForPolicy = {
		status: response.status,
		statusText: response.statusText,
		headers: Object.fromEntries(response.headers.entries()),
	};

	// Create a new cache policy
	const newPolicy = new CachePolicy(request, responseForPolicy);

	// Check if the response is cacheable
	if (newPolicy.storable()) {
		// Calculate TTL from cache policy
		const ttl = newPolicy.timeToLive();

		// Store the response and policy with appropriate TTL
		await Promise.all([
			options.cache.set(
				cacheKey,
				{
					body,
					status: response.status,
					statusText: response.statusText,
					headers: responseForPolicy.headers,
				},
				ttl,
			),
			options.cache.set(policyKey, newPolicy.toObject(), ttl),
		]);
	}

	// Return the response
	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers as HeadersInit,
	}) as UndiciResponse;
}

export type DataResponse<T = unknown> = {
	data: T;
	response: UndiciResponse;
};

// Keep GetResponse as an alias for backward compatibility
export type GetResponse<T = unknown> = DataResponse<T>;

/**
 * Perform a GET request to a URL with optional request options.
 * @param {string} url The URL to fetch.
 * @param {Omit<FetchOptions, 'method'>} options Optional request options. The `cache` property is required.
 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
 */
export async function get<T = unknown>(
	url: string,
	options: Omit<FetchOptions, "method">,
): Promise<DataResponse<T>> {
	const response = await fetch(url, { ...options, method: "GET" });
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
	}) as UndiciResponse;

	return {
		data,
		response: newResponse,
	};
}

/**
 * Perform a POST request to a URL with data and optional request options.
 * @param {string} url The URL to fetch.
 * @param {unknown} data The data to send in the request body.
 * @param {Omit<FetchOptions, 'method' | 'body'>} options Optional request options. The `cache` property is required.
 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
 */
export async function post<T = unknown>(
	url: string,
	data: unknown,
	options: Omit<FetchOptions, "method" | "body">,
): Promise<DataResponse<T>> {
	// Automatically stringify data if it's an object and set appropriate headers
	let body: BodyInit | undefined;
	const headers = { ...options.headers } as Record<string, string>;

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

	const response = await fetch(url, {
		...options,
		headers,
		body: body as RequestInit["body"],
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
	}) as UndiciResponse;

	return {
		data: responseData,
		response: newResponse,
	};
}

/**
 * Perform a PATCH request to a URL with data and optional request options.
 * @param {string} url The URL to fetch.
 * @param {unknown} data The data to send in the request body.
 * @param {Omit<FetchOptions, 'method' | 'body'>} options Optional request options. The `cache` property is required.
 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
 */
export async function patch<T = unknown>(
	url: string,
	data: unknown,
	options: Omit<FetchOptions, "method" | "body">,
): Promise<DataResponse<T>> {
	// Automatically stringify data if it's an object and set appropriate headers
	let body: BodyInit | undefined;
	const headers = { ...options.headers } as Record<string, string>;

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

	const response = await fetch(url, {
		...options,
		headers,
		body: body as RequestInit["body"],
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
	}) as UndiciResponse;

	return {
		data: responseData,
		response: newResponse,
	};
}

/**
 * Perform a DELETE request to a URL with optional data and request options.
 * @param {string} url The URL to fetch.
 * @param {unknown} data Optional data to send in the request body.
 * @param {Omit<FetchOptions, 'method' | 'body'>} options Optional request options. The `cache` property is required.
 * @returns {Promise<DataResponse<T>>} The typed data and response from the fetch.
 */
export async function del<T = unknown>(
	url: string,
	data?: unknown,
	options?: Omit<FetchOptions, "method" | "body">,
): Promise<DataResponse<T>> {
	// Handle the case where data is not provided (second param is options)
	let actualData: unknown;
	let actualOptions: Omit<FetchOptions, "method" | "body">;

	if (
		data !== undefined &&
		typeof data === "object" &&
		data !== null &&
		"cache" in data
	) {
		// Second parameter is options, not data
		actualData = undefined;
		actualOptions = data as Omit<FetchOptions, "method" | "body">;
	} else if (options) {
		// Normal case: data and options provided
		actualData = data;
		actualOptions = options;
	} else {
		// No options provided
		throw new Error("Fetch options must include a cache instance or options.");
	}

	// Automatically stringify data if it's provided and set appropriate headers
	let body: BodyInit | undefined;
	const headers = { ...actualOptions.headers } as Record<string, string>;

	if (actualData !== undefined) {
		if (typeof actualData === "string") {
			body = actualData;
		} else if (
			actualData instanceof FormData ||
			actualData instanceof URLSearchParams ||
			actualData instanceof Blob
		) {
			body = actualData as BodyInit;
		} else {
			// Assume it's JSON data
			body = JSON.stringify(actualData);
			// Set Content-Type to JSON if not already set
			if (!headers["Content-Type"] && !headers["content-type"]) {
				headers["Content-Type"] = "application/json";
			}
		}
	}

	const response = await fetch(url, {
		...actualOptions,
		headers,
		body: body as RequestInit["body"],
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
	}) as UndiciResponse;

	return {
		data: responseData,
		response: newResponse,
	};
}

/**
 * Perform a HEAD request to a URL with optional request options.
 * @param {string} url The URL to fetch.
 * @param {Omit<FetchOptions, 'method'>} options Optional request options. The `cache` property is required.
 * @returns {Promise<UndiciResponse>} The response from the fetch (no body).
 */
export async function head(
	url: string,
	options: Omit<FetchOptions, "method">,
): Promise<UndiciResponse> {
	const response = await fetch(url, { ...options, method: "HEAD" });
	return response;
}

export type Response = UndiciResponse;
export type { RequestInit as FetchRequestInit } from "undici";
