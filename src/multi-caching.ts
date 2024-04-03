import {type Cache, type Milliseconds, type WrapTTL} from './caching.js';
import EventEmitter from 'eventemitter3';

export type MultiCache = Omit<Cache, 'store'> &
Pick<Cache['store'], 'mset' | 'mget' | 'mdel'>;

/**
 * Module that lets you specify a hierarchy of caches.
 */
export function multiCaching<Caches extends Cache[]>(
	caches: Caches,
): MultiCache {
  const eventEmitter = new EventEmitter();
	const get = async <T>(key: string) => {
		for (const cache of caches) {
			try {
				// eslint-disable-next-line no-await-in-loop
				const value = await cache.get<T>(key);
				if (value !== undefined) {
					return value;
				}
			} catch {
        eventEmitter.emit('error', e);
      }
		}
	};

	const set = async <T>(
		key: string,
		data: T,
		ttl?: Milliseconds | undefined,
	) => {
		try {
      await Promise.all(caches.map(async cache => cache.set(key, data, ttl)));
    } catch (e) {
      eventEmitter.emit('error', e);
    }
	};

	return {
		get,
		set,
		async del(key) {
			try {
        await Promise.all(caches.map(async cache => cache.del(key)));
      } catch (e) {
        eventEmitter.emit('error', e);
      }
		},
		async wrap<T>(
			key: string,
			function_: () => Promise<T>,
			ttl?: WrapTTL<T>,
      refreshThreshold?: Milliseconds,
		): Promise<T> {
			let value: T | undefined;
			let i = 0;
			for (; i < caches.length; i++) {
				try {
					// eslint-disable-next-line no-await-in-loop
					value = await caches[i].get<T>(key);
					if (value !== undefined) {
						break;
					}
				} catch(e) {
                  eventEmitter.emit('error', e);
                }
			}

			if (value === undefined) {
				const result = await function_();
				const cacheTtl = typeof ttl === 'function' ? ttl(result) : ttl;
				await set<T>(key, result, cacheTtl);
				return result;
			}

			const cacheTtl = typeof ttl === 'function' ? ttl(value) : ttl;
			await Promise.all(
				caches.slice(0, i).map(async cache => cache.set(key, value, cacheTtl)),
			).then();
			await caches[i].wrap(key, function_, ttl, refreshThreshold).then(); // Call wrap for store for internal refreshThreshold logic, see: src/caching.ts caching.wrap

			return value;
		},
		async reset() {
			try {
        await Promise.all(caches.map(async x => x.reset()));
      } catch (e) {
        eventEmitter.emit('error', e);
      }
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
				} catch(e) {
                  eventEmitter.emit('error', e);
                }
			}

			return values;
		},
		async mset(arguments_: Array<[string, unknown]>, ttl?: Milliseconds) {
			try {
        await Promise.all(caches.map(async cache => cache.store.mset(arguments_, ttl)));
      } catch (e) {
        eventEmitter.emit('error', e);
      }
		},
		async mdel(...keys: string[]) {
			try {
        await Promise.all(caches.map(async cache => cache.store.mdel(...keys)));
      } catch (e) {
        eventEmitter.emit('error', e);
      }
		},
    on: (event: 'error', handler: (e: Error) => void) =>
      eventEmitter.on('error', handler),
	};
}
