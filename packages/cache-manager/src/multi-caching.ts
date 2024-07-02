import EventEmitter from 'eventemitter3';
import {
	type Cache, type Milliseconds, type WrapTTL, type ErrorEvent, type WrapOptions, defaultWrapOptions,
} from './caching.js';
import {conditionalAwait} from './utils.js';

export type MultiCache = Omit<Cache, 'store'> &
Pick<Cache['store'], 'mset' | 'mget' | 'mdel'>;

/**
 * Module that lets you specify a hierarchy of caches.
 */
export function multiCaching<Caches extends Cache[]>(
	caches: Caches,
): MultiCache {
	const eventEmitter = new EventEmitter();
	for (const cache of caches) {
		cache.on('error', event => eventEmitter.emit('error', event));
	}

	const get = async <T>(key: string) => {
		for (const cache of caches) {
			try {
				// eslint-disable-next-line no-await-in-loop
				const value = await cache.get<T>(key);
				if (value !== undefined) {
					return value;
				}
			} catch (error) {
				const errorEvent: ErrorEvent<T> = {error, key, operation: 'get'};
				eventEmitter.emit('error', errorEvent);
			}
		}
	};

	const set = async <T>(
		key: string,
		data: T,
		ttl?: Milliseconds | undefined,
		slice: number = caches.length,
	) => {
		await Promise.all(caches.slice(0, slice).map(async cache => cache.set(key, data, ttl))).catch(error => {
			const errorEvent: ErrorEvent<T> = {
				error, key, operation: 'set', data,
			};
			eventEmitter.emit('error', errorEvent);
		});
	};

	return {
		get,
		async set(key, value, ttl) {
			await set(key, value, ttl);
		},
		async del(key) {
			await Promise.all(caches.map(async cache => cache.del(key))).catch(error => {
				const errorEvent: ErrorEvent = {error, key, operation: 'del'};
				eventEmitter.emit('error', errorEvent);
			});
		},
		async wrap<T>(
			key: string,
			function_: () => Promise<T>,
			ttl?: WrapTTL<T>,
			refreshThreshold?: Milliseconds,
			options: WrapOptions = {},
		): Promise<T> {
			const options_ = {...defaultWrapOptions, ...options};
			let value: T | undefined;
			let i = 0;
			for (; i < caches.length; i++) {
				try {
					// eslint-disable-next-line no-await-in-loop
					value = await caches[i].get<T>(key);
					if (value !== undefined) {
						break;
					}
				} catch (error) {
					const errorEvent: ErrorEvent<T> = {error, key, operation: 'get'};
					eventEmitter.emit('error', errorEvent);
				}
			}

			if (value === undefined) {
				const result = await function_();
				const cacheTtl = typeof ttl === 'function' ? ttl(result) : ttl;
				await conditionalAwait(async () => set(key, result, cacheTtl), !options_.nonBlockingSet);

				return result;
			}

			const cacheTtl = typeof ttl === 'function' ? ttl(value) : ttl;
			await conditionalAwait(async () => set(key, value, cacheTtl, i).then(async () => caches[i].wrap(key, function_, ttl, refreshThreshold)), !options_.nonBlockingSet);
			return value;
		},
		async reset() {
			await Promise.all(caches.map(async x => x.reset())).catch(error => {
				const errorEvent: ErrorEvent = {error, key: '', operation: 'reset'};
				eventEmitter.emit('error', errorEvent);
			});
		},
		async mget(...keys: string[]) {
			const values = Array.from({length: keys.length}).fill(undefined);
			for (const cache of caches) {
				if (values.every(x => x !== undefined)) {
					break;
				}

				try {
					// eslint-disable-next-line no-await-in-loop
					const value = await cache.store.mget(...keys);
					for (const [i, v] of value.entries()) {
						if (values[i] === undefined && v !== undefined) {
							values[i] = v;
						}
					}
				} catch (error) {
					const errorEvent: ErrorEvent = {error, keys, operation: 'mget'};
					eventEmitter.emit('error', errorEvent);
				}
			}

			return values;
		},
		async mset(arguments_: Array<[string, unknown]>, ttl?: Milliseconds) {
			await Promise.all(caches.map(async cache => cache.store.mset(arguments_, ttl))).catch(error => {
				const keys = arguments_.map(([key]) => key);
				const data = arguments_.map(([, value]) => value);
				const errorEvent: ErrorEvent<unknown> = {
					error, keys, data, operation: 'mset',
				};
				eventEmitter.emit('error', errorEvent);
			});
		},
		async mdel(...keys: string[]) {
			await Promise.all(caches.map(async cache => cache.store.mdel(...keys)))
				.catch(error => {
					const errorEvent: ErrorEvent = {error, keys, operation: 'mdel'};
					eventEmitter.emit('error', errorEvent);
				});
		},
		on: <T> (event: 'error', handler: (event: ErrorEvent<T>) => void) => eventEmitter.on('error', handler),
		removeListener: <T>(event: 'error', handler: (error: ErrorEvent<T>) => void) => eventEmitter.removeListener(event, handler),
	};
}
