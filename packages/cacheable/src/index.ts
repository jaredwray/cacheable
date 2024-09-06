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

export enum CacheableTieringModes {
	PRIMARY_WITH_FAILOVER = 'primarySecondary',
	ACID = 'allPrimary',
	PRIMARY_ALL_FAILOVER = 'primaryAllFailover',
}

export type CacheableOptions = {
	store?: Keyv;
	enableStats?: boolean;
	enableOffline?: boolean;
	nonBlocking?: boolean;
};

export class Cacheable extends Hookified {
	private _store: Keyv = new Keyv();
	private readonly _stats: CacheableStats = {
		currentSize: 0, cacheSize: 0, hits: 0, misses: 0, hitRate: 0, averageLoadPenalty: 0, loadSuccessCount: 0, loadExceptionCount: 0, totalLoadTime: 0, topHits: [], leastUsed: [],
	};

	private _enableStats = false;
	private _enableOffline = false;

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

	public get enableOffline(): boolean {
		return this._enableOffline;
	}

	public set enableOffline(enabled: boolean) {
		this._enableOffline = enabled;
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
			await this.hook(CacheableHooks.BEFORE_GET, key);
			result = await this._store.get(key) as T;
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
			result = await this._store.set(key, value, ttl);
			await this.hook(CacheableHooks.AFTER_SET, {key, value, ttl});
		} catch (error: unknown) {
			await this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}
}
