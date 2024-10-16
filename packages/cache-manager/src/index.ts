/* eslint-disable @typescript-eslint/prefer-promise-reject-errors, unicorn/no-useless-promise-resolve-reject, no-await-in-loop, unicorn/prefer-event-target */
import EventEmitter from 'node:events';
import {Keyv} from 'keyv';
import {coalesceAsync} from './coalesce-async.js';
import {runIfFn} from './run-if-fn.js';
import {lt} from './lt.js';

export type CreateCacheOptions = {
	stores?: Keyv[];
	ttl?: number;
	refreshThreshold?: number;
	nonBlocking?: boolean;
};

export type Events = {
	set: <T>(data: {key: string; value: T; error?: unknown}) => void;
	del: (data: {key: string; error?: unknown}) => void;
	clear: (error?: unknown) => void;
	refresh: <T>(data: {key: string; value: T; error?: unknown}) => void;
};

export const createCache = (options?: CreateCacheOptions) => {
	const eventEmitter = new EventEmitter();
	const stores = options?.stores?.length ? options.stores : [new Keyv()];
	const nonBlocking = options?.nonBlocking ?? false;

	const get = async <T>(key: string) => {
		let result = null;

		if (nonBlocking) {
			try {
				result = await Promise.race(stores.map(async store => store.get<T>(key)));
				if (result === undefined) {
					return null;
				}
			} catch (error) {
				eventEmitter.emit('get', {key, error});
			}
		} else {
			for (const store of stores) {
				try {
					const cacheValue = await store.get<T>(key);
					if (cacheValue !== undefined) {
						result = cacheValue;
						eventEmitter.emit('get', {key, value: result});
						break;
					}
				} catch (error) {
					eventEmitter.emit('get', {key, error});
				}
			}
		}

		return result as T;
	};

	const mget = async <T>(keys: string[]) => {
		const result = [];

		for (const key of keys) {
			const data = await get<T>(key);
			result.push(data);
		}

		return result as [T];
	};

	const set = async <T>(stores: Keyv[], key: string, value: T, ttl?: number) => {
		try {
			if (nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				Promise.all(stores.map(async store => store.set(key, value, ttl ?? options?.ttl)));
				eventEmitter.emit('set', {key, value});
				return value;
			}

			await Promise.all(stores.map(async store => store.set(key, value, ttl ?? options?.ttl)));
			eventEmitter.emit('set', {key, value});
			return value;
		} catch (error) {
			eventEmitter.emit('set', {key, value, error});
			return Promise.reject(error);
		}
	};

	const mset = async <T>(stores: Keyv[], list: Array<{key: string; value: T; ttl?: number}>) => {
		const items = list.map(({key, value, ttl}) => ({key, value, ttl}));
		try {
			const promises = [];
			for (const item of list) {
				promises.push(stores.map(async store => store.set(item.key, item.value, item.ttl)));
			}

			await Promise.all(promises);
			eventEmitter.emit('mset', {list});
			return list;
			/* c8 ignore next 4 */
		} catch (error) {
			eventEmitter.emit('mset', {list, error});
			return Promise.reject(error);
		}
	};

	const del = async (key: string) => {
		try {
			if (nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				Promise.all(stores.map(async store => store.delete(key)));
				eventEmitter.emit('del', {key});
				return true;
			}

			await Promise.all(stores.map(async store => store.delete(key)));
			eventEmitter.emit('del', {key});
			return true;
		} catch (error) {
			eventEmitter.emit('del', {key, error});
			return Promise.reject(error);
		}
	};

	const mdel = async (keys: string[]) => {
		try {
			const promises = [];
			for (const key of keys) {
				promises.push(stores.map(async store => store.delete(key)));
			}

			if (nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				Promise.all(promises);
				eventEmitter.emit('mdel', {keys});
				return true;
			}

			await Promise.all(promises);
			eventEmitter.emit('mdel', {keys});
			return true;
			/* c8 ignore next 4 */
		} catch (error) {
			eventEmitter.emit('mdel', {keys, error});
			return Promise.reject(error);
		}
	};

	const clear = async () => {
		try {
			if (nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				Promise.all(stores.map(async store => store.clear()));
				eventEmitter.emit('clear');
				return true;
			}

			await Promise.all(stores.map(async store => store.clear()));
			eventEmitter.emit('clear');
			return true;
		} catch (error) {
			eventEmitter.emit('clear', error);
			return Promise.reject(error);
		}
	};

	const wrap = async <T>(
		key: string,
		fnc: () => T | Promise<T>,
		ttl?: number | ((value: T) => number),
		refreshThreshold?: number,
	): Promise<T> => coalesceAsync(key, async () => {
		let value: T | undefined;
		let i = 0;
		let remainingTtl: number | undefined;

		for (; i < stores.length; i++) {
			try {
				const data = await stores[i].get<T>(key, {raw: true});
				if (data !== undefined) {
					value = data.value;
					if (typeof data.expires === 'number') {
						remainingTtl = Math.max(0, data.expires - Date.now());
					}

					break;
				}
			} catch {
				//
			}
		}

		if (value === undefined) {
			const result = await fnc();
			await set(stores, key, result, runIfFn(ttl, result) ?? options?.ttl);
			return result;
		}

		const ms = runIfFn(ttl, value) ?? options?.ttl;
		const shouldRefresh = lt(remainingTtl, refreshThreshold ?? options?.refreshThreshold);

		if (shouldRefresh) {
			coalesceAsync(`+++${key}`, fnc)
				.then(async result => {
					try {
						await set(stores.slice(0, i + 1), key, result, ms);
						eventEmitter.emit('refresh', {key, value: result});
					} catch (error) {
						eventEmitter.emit('refresh', {key, value, error});
					}
				})
			// eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable
				.catch(error => {
					eventEmitter.emit('refresh', {key, value, error});
				});
		}

		if (!shouldRefresh && i > 0) {
			await set(stores.slice(0, i), key, value, ms);
		}

		return value;
	});

	const on = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.addListener(event, listener);

	const off = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.removeListener(event, listener);

	return {
		get,
		mget,
		set: async <T>(key: string, value: T, ttl?: number) => set(stores, key, value, ttl),
		mset: async <T>(list: Array<{key: string; value: T; ttl?: number}>) => mset(stores, list),
		del,
		mdel,
		clear,
		wrap,
		on,
		off,
	};
};

export {KeyvAdapter, type CacheManagerStore} from './keyv-adapter.js';
