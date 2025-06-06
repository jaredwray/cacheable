/* eslint-disable @typescript-eslint/prefer-promise-reject-errors, unicorn/no-useless-promise-resolve-reject, no-await-in-loop, unicorn/prefer-event-target */
import EventEmitter from 'node:events';
import {Keyv, type StoredDataRaw} from 'keyv';
import {coalesceAsync} from './coalesce-async.js';
import {isObject} from './is-object.js';
import {runIfFn} from './run-if-fn.js';
import {lt} from './lt.js';

export type CreateCacheOptions = {
	stores?: Keyv[];
	ttl?: number;
	refreshThreshold?: number;
	refreshAllStores?: boolean;
	nonBlocking?: boolean;
	cacheId?: string;
};

type WrapOptions<T> = {
	ttl?: number | ((value: T) => number);
	refreshThreshold?: number | ((value: T) => number);
};

type WrapOptionsRaw<T> = WrapOptions<T> & {
	raw: true;
};

export type Cache = {
	get: <T>(key: string) => Promise<T | undefined>;
	mget: <T>(keys: string[]) => Promise<Array<T | undefined>>;
	ttl: (key: string) => Promise<number | undefined>;
	set: <T>(key: string, value: T, ttl?: number) => Promise<T>;
	mset: <T>(
		list: Array<{
			key: string;
			value: T;
			ttl?: number;
		}>
	) => Promise<
		Array<{
			key: string;
			value: T;
			ttl?: number;
		}>
	>;
	del: (key: string) => Promise<boolean>;
	mdel: (keys: string[]) => Promise<boolean>;
	clear: () => Promise<boolean>;
	on: <E extends keyof Events>(
		event: E,
		listener: Events[E]
	) => EventEmitter;
	off: <E extends keyof Events>(
		event: E,
		listener: Events[E]
	) => EventEmitter;
	disconnect: () => Promise<undefined>;
	cacheId: () => string;
	stores: Keyv[];
	wrap<T>(
		key: string,
		fnc: () => T | Promise<T>,
		ttl?: number | ((value: T) => number),
		refreshThreshold?: number | ((value: T) => number)
	): Promise<T>;
	wrap<T>(
		key: string,
		fnc: () => T | Promise<T>,
		options: WrapOptions<T>
	): Promise<T>;
	wrap<T>(
		key: string,
		fnc: () => T | Promise<T>,
		options: WrapOptionsRaw<T>
	): Promise<StoredDataRaw<T>>;
};

export type Events = {
	set: <T>(data: {key: string; value: T; error?: unknown}) => void;
	del: (data: {key: string; error?: unknown}) => void;
	clear: (error?: unknown) => void;
	refresh: <T>(data: {key: string; value: T; error?: unknown}) => void;
};

export const createCache = (options?: CreateCacheOptions): Cache => {
	const eventEmitter = new EventEmitter();
	const keyv = new Keyv();
	keyv.serialize = undefined;
	keyv.deserialize = undefined;
	const stores = options?.stores?.length ? options.stores : [keyv];
	const nonBlocking = options?.nonBlocking ?? false;
	const _cacheId = options?.cacheId ?? Math.random().toString(36).slice(2);

	const get = async <T>(key: string): Promise<T | undefined> => {
		let result;

		if (nonBlocking) {
			try {
				result = await Promise.race(stores.map(async store => store.get<T>(key)));
				if (result === undefined) {
					return undefined;
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

	const mget = async <T>(keys: string[]): Promise<Array<T | undefined>> => {
		const result: Array<T | undefined> = [];

		for (const key of keys) {
			const data = await get<T>(key);
			result.push(data);
		}

		return result;
	};

	const ttl = async (key: string): Promise<number | undefined> => {
		let result;

		if (nonBlocking) {
			try {
				result = await Promise.race(stores.map(async store => store.get(key, {raw: true})));
				if (result === undefined) {
					return undefined;
				}
			} catch (error) {
				eventEmitter.emit('ttl', {key, error});
			}
		} else {
			for (const store of stores) {
				try {
					const cacheValue = await store.get(key, {raw: true});
					if (cacheValue !== undefined) {
						result = cacheValue;
						eventEmitter.emit('ttl', {key, value: result});
						break;
					}
				} catch (error) {
					eventEmitter.emit('ttl', {key, error});
				}
			}
		}

		if (result?.expires) {
			return result.expires;
		}

		return undefined;
	};

	const set = async <T>(stores: Keyv[], key: string, value: T, ttl?: number): Promise<T> => {
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
			const promises: Array<Promise<boolean>> = [];
			for (const item of list) {
				promises.push(...stores.map(async store => store.set(item.key, item.value, item.ttl)));
			}

			if (nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				Promise.all(promises);
				eventEmitter.emit('mset', {list});
				return list;
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
			const promises: Array<Promise<boolean>> = [];
			for (const key of keys) {
				promises.push(...stores.map(async store => store.delete(key)));
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
		ttlOrOptions?: number | ((value: T) => number) | Partial<WrapOptionsRaw<T>>,
		refreshThresholdParameter?: number | ((value: T) => number),
	): Promise<T | StoredDataRaw<T>> => coalesceAsync(`${_cacheId}::${key}`, async () => {
		let value: T | undefined;
		let rawData: StoredDataRaw<T> | undefined;
		let i = 0;
		let remainingTtl: number | undefined;
		const {ttl, refreshThreshold, raw} = isObject(ttlOrOptions) ? ttlOrOptions : {ttl: ttlOrOptions, refreshThreshold: refreshThresholdParameter};
		const resolveTtl = (result: T) => runIfFn(ttl, result) ?? options?.ttl;

		for (; i < stores.length; i++) {
			try {
				const data = await stores[i].get<T>(key, {raw: true});
				if (data !== undefined) {
					value = data.value;
					rawData = data;
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
			const ttl = resolveTtl(result)!;
			await set(stores, key, result, ttl);
			return raw ? {value: result, expires: Date.now() + ttl} : result;
		}

		const shouldRefresh = lt(remainingTtl, runIfFn(refreshThreshold, value) ?? options?.refreshThreshold);

		if (shouldRefresh) {
			coalesceAsync(`+++${_cacheId}__${key}`, fnc)
				// eslint-disable-next-line promise/prefer-await-to-then
				.then(async result => {
					try {
						await set(options?.refreshAllStores ? stores : stores.slice(0, i + 1), key, result, resolveTtl(result));
						eventEmitter.emit('refresh', {key, value: result});
					} catch (error) {
						eventEmitter.emit('refresh', {key, value, error});
					}
				})
			// eslint-disable-next-line @typescript-eslint/use-unknown-in-catch-callback-variable, promise/prefer-await-to-then
				.catch(error => {
					eventEmitter.emit('refresh', {key, value, error});
				});
		}

		if (!shouldRefresh && i > 0) {
			await set(stores.slice(0, i), key, value, resolveTtl(value));
		}

		return raw ? rawData : value;
	});

	const on = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.addListener(event, listener);

	const off = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.removeListener(event, listener);

	const disconnect = async () => {
		try {
			await Promise.all(stores.map(async store => store.disconnect()));
		} catch (error) {
			return Promise.reject(error);
		}
	};

	const cacheId = () => _cacheId;

	return {
		get,
		mget,
		ttl,
		set: async <T>(key: string, value: T, ttl?: number) => set(stores, key, value, ttl),
		mset: async <T>(list: Array<{key: string; value: T; ttl?: number}>) => mset(stores, list),
		del,
		mdel,
		clear,
		wrap,
		on,
		off,
		disconnect,
		cacheId,
		stores,
	};
};

export {KeyvAdapter, type CacheManagerStore} from './keyv-adapter.js';
