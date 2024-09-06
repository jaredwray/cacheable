import {Keyv} from 'keyv';
import {Hookified} from 'hookified';

type CacheableStatsItem = {
	key: string;
	lastAccessed: number;
	accessCount: number;
};

type CacheableStats = {
	cacheSize: number;
	currentSize: number;
	hits: number;
	misses: number;
	hitRate: number;
	averageLoadPenalty: number;
	loadSuccessCount: number;
	loadExceptionCount: number;
	totalLoadTime: number;
	topHits: CacheableStatsItem[];
	leastUsed: CacheableStatsItem[];
};

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

export enum CacheableTieringModes {
	BASE = 'BASE',
	ACID = 'ACID',
}

export type CacheableOptions = {
	stores?: Keyv[];
	enableStats?: boolean;
	enableOffline?: boolean;
	nonBlocking?: boolean;
};

export class Cacheable extends Hookified {
	private _stores: Keyv[] = [new Keyv()];
	private readonly _stats: CacheableStats = {
		currentSize: 0, cacheSize: 0, hits: 0, misses: 0, hitRate: 0, averageLoadPenalty: 0, loadSuccessCount: 0, loadExceptionCount: 0, totalLoadTime: 0, topHits: [], leastUsed: [],
	};

	private _enableStats = false;
	private _enableOffline = false;

	constructor(options?: CacheableOptions) {
		super();

		if (options?.stores) {
			this._stores = options.stores;
		}

		if (options?.enableStats) {
			this._enableStats = options.enableStats;
		}

		if (options?.enableOffline) {
			this._enableOffline = options.enableOffline;
		}
	}

	public get enableStats(): boolean {
		return this._enableStats;
	}

	public set enableStats(enabled: boolean) {
		this._enableStats = enabled;
	}

	public get enableOffline(): boolean {
		return this._enableOffline;
	}

	public set enableOffline(enabled: boolean) {
		this._enableOffline = enabled;
	}

	public get stores(): Keyv[] {
		return this._stores;
	}

	public set stores(keyv: Keyv[]) {
		this._stores = keyv;
	}

	public get stats(): CacheableStats {
		return this._stats;
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
