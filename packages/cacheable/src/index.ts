import {Keyv, type KeyvStoreAdapter} from 'keyv';
import {Hookified} from 'hookified';
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
	ttl?: number;
};

export type CacheableOptions = {
	primary?: Keyv | KeyvStoreAdapter;
	secondary?: Keyv | KeyvStoreAdapter;
	stats?: boolean;
	nonBlocking?: boolean;
};

export class Cacheable extends Hookified {
	private _primary: Keyv = new Keyv();
	private _secondary: Keyv | undefined;
	private _nonBlocking = false;
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
					await this._primary.set(key, result);
				}
			}

			await this.hook(CacheableHooks.AFTER_GET, {key, result});
		} catch (error: unknown) {
			await this.emit(CacheableEvents.ERROR, error);
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
						// eslint-disable-next-line no-await-in-loop
						await this._primary.set(key, secondaryResult[i]);
					}
				}
			}

			await this.hook(CacheableHooks.AFTER_GET_MANY, {keys, result});
		} catch (error: unknown) {
			await this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}

	public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
		let result = false;
		try {
			await this.hook(CacheableHooks.BEFORE_SET, {key, value, ttl});
			result = await this._primary.set(key, value, ttl);
			if (this._secondary) {
				if (this._nonBlocking) {
					// eslint-disable-next-line @typescript-eslint/no-floating-promises
					this._secondary.set(key, value, ttl);
				} else {
					await this._secondary.set(key, value, ttl);
				}
			}

			await this.hook(CacheableHooks.AFTER_SET, {key, value, ttl});
		} catch (error: unknown) {
			await this.emit(CacheableEvents.ERROR, error);
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
			await this.emit(CacheableEvents.ERROR, error);
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
		let result = await this._primary.has(key);
		if (!result && this._secondary) {
			result = await this._secondary.has(key);
		}

		return result;
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
		const result = await this._primary.delete(key);
		if (this._secondary) {
			if (this._nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				this._secondary.delete(key);
			} else {
				await this._secondary.delete(key);
			}
		}

		return result;
	}

	public async deleteMany(keys: string[]): Promise<boolean> {
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
		await this._primary.clear();
		if (this._secondary) {
			if (this._nonBlocking) {
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				this._secondary.clear();
			} else {
				await this._secondary.clear();
			}
		}
	}

	public async disconnect(): Promise<void> {
		await this._primary.disconnect();
		if (this._secondary) {
			await this._secondary.disconnect();
		}
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
			promises.push(keyv.set(item.key, item.value, item.ttl));
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
}
