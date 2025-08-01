import {type Cacheable, type CacheableOptions} from 'cacheable';
import {fetch as undiciFetch, type RequestInit, type Response as UndiciResponse} from 'undici';

export type FetchOptions = RequestInit & {
	cacheable: Cacheable | CacheableOptions;
};

export async function fetch(url: string, options?: FetchOptions): Promise<UndiciResponse> {
	return undiciFetch(url, options);
}

export type Response = UndiciResponse;
export type {RequestInit} from 'undici';
