import {type Cache, type Milliseconds, type WrapTTL} from './caching';

export type MultiCache = Omit<Cache, 'store'> &
Pick<Cache['store'], 'mset' | 'mget' | 'mdel'>;

/**
 * Module that lets you specify a hierarchy of caches.
 */
export function multiCaching<Caches extends Cache[]>(
	caches: Caches,
): MultiCache {
	const get = async <T>(key: string) => {
		for (const cache of caches) {
			try {
				const value = await cache.get<T>(key);
				if (value !== undefined) {
					return value;
				}
			} catch {}
		}
	};

	const set = async <T>(
		key: string,
		data: T,
		ttl?: Milliseconds | undefined,
	) => {
		await Promise.all(caches.map(async cache => cache.set(key, data, ttl)));
	};

	return {
		get,
		set,
		async del(key) {
			await Promise.all(caches.map(async cache => cache.del(key)));
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
					value = await caches[i].get<T>(key);
					if (value !== undefined) {
						break;
					}
				} catch {}
			}

			if (value === undefined) {
				const result = await function_();
				const cacheTTL = typeof ttl === 'function' ? ttl(result) : ttl;
				await set<T>(key, result, cacheTTL);
				return result;
			}

			const cacheTTL = typeof ttl === 'function' ? ttl(value) : ttl;
			Promise.all(
				caches.slice(0, i).map(async cache => cache.set(key, value, cacheTTL)),
			).then();
			caches[i].wrap(key, function_, ttl, refreshThreshold).then(); // Call wrap for store for internal refreshThreshold logic, see: src/caching.ts caching.wrap

			return value;
		},
		async reset() {
			await Promise.all(caches.map(async x => x.reset()));
		},
		async mget(...keys: string[]) {
			const values = Array.from({length: keys.length}).fill(undefined);
			for (const cache of caches) {
				if (values.every(x => x !== undefined)) {
					break;
				}

				try {
					const value = await cache.store.mget(...keys);
					for (const [i, v] of value.entries()) {
						if (values[i] === undefined && v !== undefined) {
							values[i] = v;
						}
					}
				} catch {}
			}

			return values;
		},
		async mset(arguments_: Array<[string, unknown]>, ttl?: Milliseconds) {
			await Promise.all(caches.map(async cache => cache.store.mset(arguments_, ttl)));
		},
		async mdel(...keys: string[]) {
			await Promise.all(caches.map(async cache => cache.store.mdel(...keys)));
		},
	};
}
