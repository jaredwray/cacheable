import {Keyv} from 'keyv';
import {Hookified} from 'hookified';

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

export enum CacheWriteMode {
	BASE = 'BASE',
	ACID = 'ACID',
}

export enum CacheReadMode {
	ASCENDING_COALESCE = 'ASCENDING_COALESCE',
	FIRST_RETURN = 'FIRST_RETURN',
}

export type CacheableOptions = {
	store: Keyv;
	stores?: Keyv[];
	enableStats?: boolean;
	nonBlocking?: boolean;
};

export class Cacheable extends Hookified {
	private _stores: Keyv[] = [new Keyv()];
	private _enableStats = false;

	constructor(options?: CacheableOptions) {
		super();

		if (options?.store) {
			this._stores = [options.store];
		}

		if (options?.stores) {
			this._stores = this._stores.concat(options?.stores);
		}

		if (options?.enableStats) {
			this._enableStats = options.enableStats;
		}
	}

	public get enableStats(): boolean {
		return this._enableStats;
	}

	public set enableStats(enabled: boolean) {
		this._enableStats = enabled;
	}

	public get stores(): Keyv[] {
		return this._stores;
	}

	public set stores(keyv: Keyv[]) {
		this._stores = keyv;
	}

	public async get<T>(key: string): Promise<T | undefined> {
		let result;
		try {
			await this.hook(CacheableHooks.BEFORE_GET, key);
			result = await this._stores[0].get(key) as T;
			await this.hook(CacheableHooks.AFTER_GET, {key, result});
		} catch (error: unknown) {
			await this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}

	public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
		let result = false;
		try {
			await this.hook(CacheableHooks.BEFORE_SET, {key, value, ttl});
			result = await this._stores[0].set(key, value, ttl);
			await this.hook(CacheableHooks.AFTER_SET, {key, value, ttl});
		} catch (error: unknown) {
			await this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}
}
