import {Keyv, type KeyvStoreAdapter} from 'keyv';
import {Hookified} from 'hookified';
import {shorthandToMilliseconds} from './shorthand-time.js';
import {KeyvCacheableMemory} from './keyv-memory.js';
import {CacheableStats} from './stats.js';

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

export type CacheableItem = {
	key: string;
	value: unknown;
	ttl?: number | string;
};

export type CacheableOptions = {
	primary?: Keyv | KeyvStoreAdapter;
	secondary?: Keyv | KeyvStoreAdapter;
	stats?: boolean;
	nonBlocking?: boolean;
	ttl?: number | string;
};

export class Cacheable extends Hookified {
	private _primary: Keyv = new Keyv({store: new KeyvCacheableMemory()});
	private _secondary: Keyv | undefined;
	private _nonBlocking = false;
	private _ttl?: number | string;
	private readonly _stats = new CacheableStats({enabled: false});

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
	}

	public get stats(): CacheableStats {
		return this._stats;
	}

	public get primary(): Keyv {
		return this._primary;
	}

	public set primary(primary: Keyv) {
		this._primary = primary;
	}

	public get secondary(): Keyv | undefined {
		return this._secondary;
	}

	public set secondary(secondary: Keyv | undefined) {
		this._secondary = secondary;
	}

	public get nonBlocking(): boolean {
		return this._nonBlocking;
	}

	public set nonBlocking(nonBlocking: boolean) {
		this._nonBlocking = nonBlocking;
	}

	public get ttl(): number | string | undefined {
		return this._ttl;
	}

	public set ttl(ttl: number | string | undefined) {
		this.setTtl(ttl);
	}

	public setPrimary(primary: Keyv | KeyvStoreAdapter): void {
		this._primary = primary instanceof Keyv ? primary : new Keyv(primary);
	}

	public setSecondary(secondary: Keyv | KeyvStoreAdapter): void {
		this._secondary = secondary instanceof Keyv ? secondary : new Keyv(secondary);
	}

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

	public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
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

	public async take<T>(key: string): Promise<T | undefined> {
		const result = await this.get<T>(key);
		await this.delete(key);

		return result;
	}

	public async takeMany<T>(keys: string[]): Promise<Array<T | undefined>> {
		const result = await this.getMany<T>(keys);
		await this.deleteMany(keys);

		return result;
	}

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

	public async delete(key: string): Promise<boolean> {
		let result = false;
		const promises = [];
		if (this.stats.enabled) {
			const statResult = await this._primary.get(key);
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

	public async deleteMany(keys: string[]): Promise<boolean> {
		if (this.stats.enabled) {
			const statResult = await this._primary.get(keys);
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

	public async disconnect(): Promise<void> {
		const promises = [];
		promises.push(this._primary.disconnect());
		if (this._secondary) {
			promises.push(this._secondary.disconnect());
		}

		await (this._nonBlocking ? Promise.race(promises) : Promise.all(promises));
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
export {CacheableMemory} from './memory.js';
export {KeyvCacheableMemory} from './keyv-memory.js';
export {shorthandToMilliseconds, shorthandToTime} from './shorthand-time.js';
