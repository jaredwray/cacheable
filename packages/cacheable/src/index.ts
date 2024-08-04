import Keyv from 'keyv';
import EventEmitter from 'eventemitter3';

type HookFunction = (...args: any[]) => void;

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
	PRE_SET = 'preSet',
	POST_SET = 'postSet',
	PRE_SET_MANY = 'preSetMany',
	POST_SET_MANY = 'postSetMany',
	PRE_GET = 'preGet',
	POST_GET = 'postGet',
	PRE_GET_MANY = 'preGetMany',
	POST_GET_MANY = 'postGetMany',
}

export enum CacheableEvents {
	ERROR = 'error',
}

export class Cacheable extends EventEmitter {
	private _store: Keyv = new Keyv();
	private readonly _stats: CacheableStats = {currentSize: 0, cacheSize: 0, hits: 0, misses: 0, hitRate: 0, averageLoadPenalty: 0, loadSuccessCount: 0, loadExceptionCount: 0, totalLoadTime: 0, topHits: [], leastUsed: []};
	private readonly _hooks = new Map<string, HookFunction>();
	private _cacheSizeLimit = 0;
	private _statsEnabled = false;

	constructor(keyv?: Keyv) {
		super();

		if (keyv) {
			this._store = keyv;
		}
	}

	public get statsEnabled(): boolean {
		return this._statsEnabled;
	}

	public set statsEnabled(enabled: boolean) {
		this._statsEnabled = enabled;
	}

	public get cacheSizeLimit(): number {
		return this._cacheSizeLimit;
	}

	public set cacheSizeLimit(limit: number) {
		this._cacheSizeLimit = limit;
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

	public get hooks(): Map<string, HookFunction> {
		return this._hooks;
	}

	public setHook(name: string, fn: HookFunction): void {
		this._hooks.set(name, fn);
	}

	public deleteHook(name: string): void {
		this._hooks.delete(name);
	}

	public triggerHook(name: string, ...args: any[]) {
		const hook = this._hooks.get(name);
		if (hook) {
			/* eslint-disable-next-line @typescript-eslint/no-unsafe-argument */
			hook(...args);
		}
	}

	public async get<T>(key: string): Promise<T | undefined> {
		let result;
		try {
			this.triggerHook(CacheableHooks.PRE_GET, key);
			result = await this._store.get(key) as T;
			this.triggerHook(CacheableHooks.POST_GET, key, result);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}

	public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
		let result = false;
		try {
			this.triggerHook(CacheableHooks.PRE_SET, key, value, ttl);
			result = await this._store.set(key, value, ttl);
			this.triggerHook(CacheableHooks.POST_SET, key, value, ttl);
		} catch (error: unknown) {
			this.emit(CacheableEvents.ERROR, error);
		}

		return result;
	}
}
