import {Keyv} from 'keyv';
import { Hookified } from 'hookified';

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
	BEFORE_SET = 'beforeSet',
	AFTER_SET = 'afterSet',
	BEFORE_SET_MANY = 'beforeSetMany',
	AFTER_SET_MANY = 'afterSetMany',
	BEFORE_GET = 'beforeGet',
	AFTER_GET = 'afterGet',
	BEFORE_GET_MANY = 'beforeGetMany',
	AFTER_GET_MANY = 'afterGetMany',
}

export enum CacheableEvents {
	ERROR = 'error',
}

export type CacheableOptions = {
	store?: Keyv;
	offlineMode?: boolean;
	enableStats?: boolean;
};

export class Cacheable extends Hookified {
	private _store: Keyv = new Keyv();
	private readonly _stats: CacheableStats = {currentSize: 0, cacheSize: 0, hits: 0, misses: 0, hitRate: 0, averageLoadPenalty: 0, loadSuccessCount: 0, loadExceptionCount: 0, totalLoadTime: 0, topHits: [], leastUsed: []};
	private _enableStats = false;
	private _offlineMode = false;

	constructor(keyv?: Keyv) {
		super();

		if (keyv) {
			this._store = keyv;
		}
	}

	public get enableStats(): boolean {
		return this._enableStats;
	}

	public set enableStats(enabled: boolean) {
		this._enableStats = enabled;
	}

	public get offlineMode(): boolean {
		return this._offlineMode;
	}

	public get store(): Keyv {
		return this._store;
	}

	public set store(keyv: Keyv) {
		this._store = keyv;
	}

	public get stats(): CacheableStats {
		return this._stats;
	}

	public async get<T>(key: string): Promise<T | undefined> {
		let result;
		try {
			this.hook(CacheableHooks.PRE_GET, key);
			result = await this._store.get(key) as T;
			this.hook(CacheableHooks.POST_GET, key, result);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}

	public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
		let result = false;
		try {
			this.hook(CacheableHooks.PRE_SET, key, value, ttl);
			result = await this._store.set(key, value, ttl);
			this.hook(CacheableHooks.POST_SET, key, value, ttl);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}
}
