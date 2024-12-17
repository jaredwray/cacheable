import {Keyv, type KeyvStoreAdapter} from 'keyv';
import {Hookified} from 'hookified';
import {shorthandToMilliseconds} from './shorthand-time.js';
import {createKeyv} from './keyv-memory.js';
import {CacheableStats} from './stats.js';
import {type CacheableItem} from './cacheable-item-types.js';
import {hash} from './hash.js';
import {wrap, type WrapFunctionOptions} from './wrap.js';

export enum CacheableHooks {
	BEFORE_SET = 'BEFORE_SET',
	AFTER_SET = 'AFTER_SET',
	BEFORE_SET_MANY = 'BEFORE_SET_MANY',
	AFTER_SET_MANY = 'AFTER_SET_MANY',
	BEFORE_GET = 'BEFORE_GET',
	AFTER_GET = 'AFTER_GET',
	BEFORE_GET_MANY = 'BEFORE_GET_MANY',
	AFTER_GET_MANY = 'AFTER_GET_MANY',
}

export enum CacheableEvents {
	ERROR = 'error',
}

export type CacheableOptions = {
	primary?: Keyv | KeyvStoreAdapter;
	secondary?: Keyv | KeyvStoreAdapter;
	stats?: boolean;
	nonBlocking?: boolean;
	ttl?: number | string;
	namespace?: string | (() => string);
};

export class Cacheable extends Hookified {
	private _primary: Keyv = createKeyv();
	private _secondary: Keyv | undefined;
	private _nonBlocking = false;
	private _ttl?: number | string;
	private readonly _stats = new CacheableStats({enabled: false});
	private _namespace?: string | (() => string);

	/**
	 * Creates a new cacheable instance
	 * @param {CacheableOptions} [options] The options for the cacheable instance
	 */
	constructor(options?: CacheableOptions) {
		super();

		if (options?.primary) {
			this.setPrimary(options.primary);
		}

		if (options?.secondary) {
			this.setSecondary(options.secondary);
		}

		if (options?.nonBlocking) {
			this._nonBlocking = options.nonBlocking;
		}

		if (options?.stats) {
			this._stats.enabled = options.stats;
		}

		if (options?.ttl) {
			this.setTtl(options.ttl);
		}

		if (options?.namespace) {
			this._namespace = options.namespace;
			this._primary.namespace = this.getNameSpace();
			if (this._secondary) {
				this._secondary.namespace = this.getNameSpace();
			}
		}
	}

	/**
	 * The namespace for the cacheable instance
	 * @returns {string | (() => string) | undefined} The namespace for the cacheable instance
	 */
	public get namespace(): string | (() => string) | undefined {
		return this._namespace;
	}

	/**
	 * Sets the namespace for the cacheable instance
	 * @param {string | (() => string) | undefined} namespace The namespace for the cacheable instance
	 * @returns {void}
	 */
	public set namespace(namespace: string | (() => string) | undefined) {
		this._namespace = namespace;
		this._primary.namespace = this.getNameSpace();
		if (this._secondary) {
			this._secondary.namespace = this.getNameSpace();
		}
	}

	/**
	 * The statistics for the cacheable instance
	 * @returns {CacheableStats} The statistics for the cacheable instance
	 */
	public get stats(): CacheableStats {
		return this._stats;
	}

	/**
	 * The primary store for the cacheable instance
	 * @returns {Keyv} The primary store for the cacheable instance
	 */
	public get primary(): Keyv {
		return this._primary;
	}

	/**
	 * Sets the primary store for the cacheable instance
	 * @param {Keyv} primary The primary store for the cacheable instance
	 */
	public set primary(primary: Keyv) {
		this._primary = primary;
	}

	/**
	 * The secondary store for the cacheable instance
	 * @returns {Keyv | undefined} The secondary store for the cacheable instance
	 */
	public get secondary(): Keyv | undefined {
		return this._secondary;
	}

	/**
	 * Sets the secondary store for the cacheable instance. If it is set to undefined then the secondary store is disabled.
	 * @param {Keyv | undefined} secondary The secondary store for the cacheable instance
	 * @returns {void}
	 */
	public set secondary(secondary: Keyv | undefined) {
		this._secondary = secondary;
	}

	/**
	 * Gets whether the secondary store is non-blocking mode. It is set to false by default.
	 * If it is set to true then the secondary store will not block the primary store.
	 *
	 * [Learn more about non-blocking mode](https://cacheable.org/docs/cacheable/#non-blocking-operations).
	 *
	 * @returns {boolean} Whether the cacheable instance is non-blocking
	 */
	public get nonBlocking(): boolean {
		return this._nonBlocking;
	}

	/**
	 * Sets whether the secondary store is non-blocking mode. It is set to false by default.
	 * If it is set to true then the secondary store will not block the primary store.
	 *
	 * [Learn more about non-blocking mode](https://cacheable.org/docs/cacheable/#non-blocking-operations).
	 *
	 * @param {boolean} nonBlocking Whether the cacheable instance is non-blocking
	 * @returns {void}
	 */
	public set nonBlocking(nonBlocking: boolean) {
		this._nonBlocking = nonBlocking;
	}

	/**
	 * The time-to-live for the cacheable instance and will be used as the default value.
	 * can be a number in milliseconds or a human-readable format such as `1s` for 1 second or `1h` for 1 hour
	 * or undefined if there is no time-to-live.
	 *
	 * [Learn more about time-to-live](https://cacheable.org/docs/cacheable/#shorthand-for-time-to-live-ttl).
	 *
	 * @returns {number | string | undefined} The time-to-live for the cacheable instance in milliseconds, human-readable format or undefined
	 * @example
	 * ```typescript
	 * const cacheable = new Cacheable({ ttl: '1h' });
	 * console.log(cacheable.ttl); // 1h
	 * ```
	 */
	public get ttl(): number | string | undefined {
		return this._ttl;
	}

	/**
	 * Sets the time-to-live for the cacheable instance and will be used as the default value.
	 * If you set a number it is miliseconds, if you set a string it is a human-readable
	 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that
	 * there is no time-to-live.
	 *
	 * [Learn more about time-to-live](https://cacheable.org/docs/cacheable/#shorthand-for-time-to-live-ttl).
	 *
	 * @param {number | string | undefined} ttl The time-to-live for the cacheable instance
	 * @example
	 * ```typescript
	 * const cacheable = new Cacheable();
	 * cacheable.ttl = '1h'; // Set the time-to-live to 1 hour
	 * ```
	 * or setting the time-to-live in milliseconds
	 * ```typescript
	 * const cacheable = new Cacheable();
	 * cacheable.ttl = 3600000; // Set the time-to-live to 1 hour
	 * ```
	 */
	public set ttl(ttl: number | string | undefined) {
		this.setTtl(ttl);
	}

	/**
	 * Sets the primary store for the cacheable instance
	 * @param {Keyv | KeyvStoreAdapter} primary The primary store for the cacheable instance
	 * @returns {void}
	 */
	public setPrimary(primary: Keyv | KeyvStoreAdapter): void {
		this._primary = primary instanceof Keyv ? primary : new Keyv(primary);
		/* c8 ignore next 3 */
		this._primary.on('error', (error: unknown) => {
			this.emit(CacheableEvents.ERROR, error);
		});
	}

	/**
	 * Sets the secondary store for the cacheable instance. If it is set to undefined then the secondary store is disabled.
	 * @param {Keyv | KeyvStoreAdapter} secondary The secondary store for the cacheable instance
	 * @returns {void}
	 */
	public setSecondary(secondary: Keyv | KeyvStoreAdapter): void {
		this._secondary = secondary instanceof Keyv ? secondary : new Keyv(secondary);
		/* c8 ignore next 3 */
		this._secondary.on('error', (error: unknown) => {
			this.emit(CacheableEvents.ERROR, error);
		});
	}

	public getNameSpace(): string | undefined {
		if (typeof this._namespace === 'function') {
			return this._namespace();
		}

		return this._namespace;
	}

	/**
	 * Gets the value of the key. If the key does not exist in the primary store then it will check the secondary store.
	 * @param {string} key The key to get the value of
	 * @returns {Promise<T | undefined>} The value of the key or undefined if the key does not exist
	 */
	public async get<T>(key: string): Promise<T | undefined> {
		let result;
		try {
			await this.hook(CacheableHooks.BEFORE_GET, key);
			result = await this._primary.get(key) as T;
			if (!result && this._secondary) {
				result = await this._secondary.get(key) as T;
				if (result) {
					const finalTtl = shorthandToMilliseconds(this._ttl);
					await this._primary.set(key, result, finalTtl);
				}
			}

			await this.hook(CacheableHooks.AFTER_GET, {key, result});
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			if (result) {
				this._stats.incrementHits();
			} else {
				this._stats.incrementMisses();
			}

			this.stats.incrementGets();
		}

		return result;
	}

	/**
	 * Gets the values of the keys. If the key does not exist in the primary store then it will check the secondary store.
	 * @param {string[]} keys The keys to get the values of
	 * @returns {Promise<Array<T | undefined>>} The values of the keys or undefined if the key does not exist
	 */
	public async getMany<T>(keys: string[]): Promise<Array<T | undefined>> {
		let result: Array<T | undefined> = [];
		try {
			await this.hook(CacheableHooks.BEFORE_GET_MANY, keys);
			result = await this._primary.get(keys) as Array<T | undefined>;
			if (this._secondary) {
				const missingKeys = [];
				for (const [i, key] of keys.entries()) {
					if (!result[i]) {
						missingKeys.push(key);
					}
				}

				const secondaryResult = await this._secondary.get(missingKeys) as Array<T | undefined>;
				for (const [i, key] of keys.entries()) {
					if (!result[i] && secondaryResult[i]) {
						result[i] = secondaryResult[i];

						const finalTtl = shorthandToMilliseconds(this._ttl);
						// eslint-disable-next-line no-await-in-loop
						await this._primary.set(key, secondaryResult[i], finalTtl);
					}
				}
			}

			await this.hook(CacheableHooks.AFTER_GET_MANY, {keys, result});
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			for (const item of result) {
				if (item) {
					this._stats.incrementHits();
				} else {
					this._stats.incrementMisses();
				}
			}

			this.stats.incrementGets();
		}

		return result;
	}

	/**
	 * Sets the value of the key. If the secondary store is set then it will also set the value in the secondary store.
	 * @param {string} key the key to set the value of
	 * @param {T} value The value to set
	 * @param {number | string} [ttl] set a number it is miliseconds, set a string it is a human-readable
	 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live.
	 * @returns {boolean} Whether the value was set
	 */
	public async set<T>(key: string, value: T, ttl?: number | string): Promise<boolean> {
		let result = false;
		const finalTtl = shorthandToMilliseconds(ttl ?? this._ttl);
		try {
			const item = {key, value, ttl: finalTtl};
			await this.hook(CacheableHooks.BEFORE_SET, item);
			const promises = [];
			promises.push(this._primary.set(item.key, item.value, item.ttl));
			if (this._secondary) {
				promises.push(this._secondary.set(item.key, item.value, item.ttl));
			}

			if (this._nonBlocking) {
				result = await Promise.race(promises);
			} else {
				const results = await Promise.all(promises);
				result = results[0];
			}

			await this.hook(CacheableHooks.AFTER_SET, item);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			this.stats.incrementKSize(key);
			this.stats.incrementCount();
			this.stats.incrementVSize(value);
			this.stats.incrementSets();
		}

		return result;
	}

	/**
	 * Sets the values of the keys. If the secondary store is set then it will also set the values in the secondary store.
	 * @param {CacheableItem[]} items The items to set
	 * @returns {boolean} Whether the values were set
	 */
	public async setMany(items: CacheableItem[]): Promise<boolean> {
		let result = false;
		try {
			await this.hook(CacheableHooks.BEFORE_SET_MANY, items);
			result = await this.setManyKeyv(this._primary, items);
			if (this._secondary) {
				if (this._nonBlocking) {
					// eslint-disable-next-line @typescript-eslint/no-floating-promises
					this.setManyKeyv(this._secondary, items);
				} else {
					await this.setManyKeyv(this._secondary, items);
				}
			}

			await this.hook(CacheableHooks.AFTER_SET_MANY, items);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		if (this.stats.enabled) {
			for (const item of items) {
				this.stats.incrementKSize(item.key);
				this.stats.incrementCount();
				this.stats.incrementVSize(item.value);
			}
		}

		return result;
	}

	/**
	 * Takes the value of the key and deletes the key. If the key does not exist then it will return undefined.
	 * @param {string} key The key to take the value of
	 * @returns {Promise<T | undefined>} The value of the key or undefined if the key does not exist
	 */
	public async take<T>(key: string): Promise<T | undefined> {
		const result = await this.get<T>(key);
		await this.delete(key);

		return result;
	}

	/**
	 * Takes the values of the keys and deletes the keys. If the key does not exist then it will return undefined.
	 * @param {string[]} keys The keys to take the values of
	 * @returns {Promise<Array<T | undefined>>} The values of the keys or undefined if the key does not exist
	 */
	public async takeMany<T>(keys: string[]): Promise<Array<T | undefined>> {
		const result = await this.getMany<T>(keys);
		await this.deleteMany(keys);

		return result;
	}

	/**
	 * Checks if the key exists in the primary store. If it does not exist then it will check the secondary store.
	 * @param {string} key The key to check
	 * @returns {Promise<boolean>} Whether the key exists
	 */
	public async has(key: string): Promise<boolean> {
		const promises = [];
		promises.push(this._primary.has(key));
		if (this._secondary) {
			promises.push(this._secondary.has(key));
		}

		const resultAll = await Promise.all(promises);
		for (const result of resultAll) {
			if (result) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if the keys exist in the primary store. If it does not exist then it will check the secondary store.
	 * @param {string[]} keys The keys to check
	 * @returns {Promise<boolean[]>} Whether the keys exist
	 */
	public async hasMany(keys: string[]): Promise<boolean[]> {
		const result = await this.hasManyKeyv(this._primary, keys);
		const missingKeys = [];
		for (const [i, key] of keys.entries()) {
			if (!result[i] && this._secondary) {
				missingKeys.push(key);
			}
		}

		if (missingKeys.length > 0 && this._secondary) {
			const secondary = await this.hasManyKeyv(this._secondary, keys);
			for (const [i, key] of keys.entries()) {
				if (!result[i] && secondary[i]) {
					result[i] = secondary[i];
				}
			}
		}

		return result;
	}

	/**
	 * Deletes the key from the primary store. If the secondary store is set then it will also delete the key from the secondary store.
	 * @param {string} key The key to delete
	 * @returns {Promise<boolean>} Whether the key was deleted
	 */
	public async delete(key: string): Promise<boolean> {
		let result = false;
		const promises = [];
		if (this.stats.enabled) {
			const statResult = await this._primary.get<Record<string, unknown>>(key);
			if (statResult) {
				this.stats.decreaseKSize(key);
				this.stats.decreaseVSize(statResult);
				this.stats.decreaseCount();
				this.stats.incrementDeletes();
			}
		}

		promises.push(this._primary.delete(key));
		if (this._secondary) {
			promises.push(this._secondary.delete(key));
		}

		if (this.nonBlocking) {
			result = await Promise.race(promises);
		} else {
			const resultAll = await Promise.all(promises);
			result = resultAll[0];
		}

		return result;
	}

	/**
	 * Deletes the keys from the primary store. If the secondary store is set then it will also delete the keys from the secondary store.
	 * @param {string[]} keys The keys to delete
	 * @returns {Promise<boolean>} Whether the keys were deleted
	 */
	public async deleteMany(keys: string[]): Promise<boolean> {
		if (this.stats.enabled) {
			const statResult = await this._primary.get(keys) as unknown;
			for (const key of keys) {
				this.stats.decreaseKSize(key);
				this.stats.decreaseVSize(statResult);
				this.stats.decreaseCount();
				this.stats.incrementDeletes();
			}
		}

		const result = await this.deleteManyKeyv(this._primary, keys);
		if (this._secondary) {
			if (this._nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				this.deleteManyKeyv(this._secondary, keys);
			} else {
				await this.deleteManyKeyv(this._secondary, keys);
			}
		}

		return result;
	}

	/**
	 * Clears the primary store. If the secondary store is set then it will also clear the secondary store.
	 * @returns {Promise<void>}
	 */
	public async clear(): Promise<void> {
		const promises = [];
		promises.push(this._primary.clear());
		if (this._secondary) {
			promises.push(this._secondary.clear());
		}

		await (this._nonBlocking ? Promise.race(promises) : Promise.all(promises));

		if (this.stats.enabled) {
			this._stats.resetStoreValues();
			this._stats.incrementClears();
		}
	}

	/**
	 * Disconnects the primary store. If the secondary store is set then it will also disconnect the secondary store.
	 * @returns {Promise<void>}
	 */
	public async disconnect(): Promise<void> {
		const promises = [];
		promises.push(this._primary.disconnect());
		if (this._secondary) {
			promises.push(this._secondary.disconnect());
		}

		await (this._nonBlocking ? Promise.race(promises) : Promise.all(promises));
	}

	/**
	 * Wraps a function with caching
	 *
	 * [Learn more about wrapping functions](https://cacheable.org/docs/cacheable/#wrap--memoization-for-sync-and-async-functions).
	 * @param {Function} function_ The function to wrap
	 * @param {WrapOptions} [options] The options for the wrap function
	 * @returns {Function} The wrapped function
	 */
	public wrap<T, Arguments extends any[]>(function_: (...arguments_: Arguments) => T, options?: WrapFunctionOptions): (...arguments_: Arguments) => T {
		const wrapOptions = {
			ttl: options?.ttl ?? this._ttl,
			keyPrefix: options?.keyPrefix,
			cache: this,
		};

		return wrap<T>(function_, wrapOptions);
	}

	/**
	 * Will hash an object using the specified algorithm. The default algorithm is 'sha256'.
	 * @param {any} object the object to hash
	 * @param {string} algorithm the hash algorithm to use. The default is 'sha256'
	 * @returns {string} the hash of the object
	 */
	public hash(object: any, algorithm = 'sha256'): string {
		return hash(object, algorithm);
	}

	private async deleteManyKeyv(keyv: Keyv, keys: string[]): Promise<boolean> {
		const promises = [];
		for (const key of keys) {
			promises.push(keyv.delete(key));
		}

		await Promise.all(promises);

		return true;
	}

	private async setManyKeyv(keyv: Keyv, items: CacheableItem[]): Promise<boolean> {
		const promises = [];
		for (const item of items) {
			const finalTtl = shorthandToMilliseconds(item.ttl ?? this._ttl);
			promises.push(keyv.set(item.key, item.value, finalTtl));
		}

		await Promise.all(promises);

		return true;
	}

	private async hasManyKeyv(keyv: Keyv, keys: string[]): Promise<boolean[]> {
		const promises = [];
		for (const key of keys) {
			promises.push(keyv.has(key));
		}

		return Promise.all(promises);
	}

	private setTtl(ttl: number | string | undefined): void {
		if (typeof ttl === 'string' || ttl === undefined) {
			this._ttl = ttl;
		} else if (ttl > 0) {
			this._ttl = ttl;
		} else {
			this._ttl = undefined;
		}
	}
}

export {CacheableStats} from './stats.js';
export {CacheableMemory, type CacheableMemoryOptions} from './memory.js';
export {KeyvCacheableMemory, createKeyv} from './keyv-memory.js';
export {shorthandToMilliseconds, shorthandToTime} from './shorthand-time.js';
export type {CacheableItem} from './cacheable-item-types.js';
export {
	type KeyvStoreAdapter, type KeyvOptions, KeyvHooks, Keyv,
} from 'keyv';
export {
	wrap, wrapSync, type WrapOptions, type WrapSyncOptions,
} from './wrap.js';
