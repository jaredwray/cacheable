// biome-ignore-all lint/suspicious/noExplicitAny: allowed

/**
 * A counter field that can be incremented or decremented via the unified
 * {@link Stats.increment} / {@link Stats.decrement} API or an event map.
 */
export type StatField =
	| "hits"
	| "misses"
	| "gets"
	| "sets"
	| "deletes"
	| "clears"
	| "count";

/**
 * A duck-typed event emitter. This intentionally matches both `Hookified`
 * (used by `cacheable`, `node-cache`, `memory`, `flat-cache`) and Node's
 * built-in `EventEmitter` (used by `cache-manager`, `cacheable-request`)
 * without adding a hard dependency on either.
 */
export type StatsEmitter = {
	on(event: string, listener: (...args: any[]) => void): unknown;
	off?(event: string, listener: (...args: any[]) => void): unknown;
	removeListener?(event: string, listener: (...args: any[]) => void): unknown;
};

/**
 * A custom handler invoked when a subscribed event fires. It receives the
 * {@link Stats} instance and the raw event arguments (which may be positional,
 * e.g. node-cache emits `(key, value)`).
 */
export type StatsEventHandler = (stats: Stats, ...args: any[]) => void;

/**
 * Maps an event name to the stat update it should perform: a single field to
 * increment, an array of fields to increment, or a custom handler.
 */
export type StatsEventMap = Record<
	string,
	StatField | StatField[] | StatsEventHandler
>;

/**
 * A plain-object snapshot of a {@link Stats} instance, suitable for logging,
 * metrics, or serialization. Returned by {@link Stats.toJSON}.
 */
export type StatsSnapshot = {
	enabled: boolean;
	hits: number;
	misses: number;
	gets: number;
	sets: number;
	deletes: number;
	clears: number;
	vsize: number;
	ksize: number;
	count: number;
	hitRate: number;
	missRate: number;
	lastUpdated?: number;
	lastReset?: number;
};

export type StatsOptions = {
	/** Whether the stats are enabled. Defaults to `false`. */
	enabled?: boolean;
	/** Optionally subscribe to an emitter immediately on construction. */
	emitter?: StatsEmitter;
	/**
	 * The event map to use when `emitter` is provided. Defaults to
	 * {@link cacheableStatsEventMap}.
	 */
	eventMap?: StatsEventMap;
};

/**
 * The default event map for `cacheable` instances. `cacheable` only emits
 * `cache:hit` and `cache:miss` on its instance (set/delete are distributed
 * sync events, not instance events), so a hit/miss also counts as a get.
 */
export const cacheableStatsEventMap: StatsEventMap = {
	"cache:hit": ["hits", "gets"],
	"cache:miss": ["misses", "gets"],
};

/**
 * Event map for `@cacheable/node-cache` instances. node-cache emits with
 * positional arguments (e.g. `set(key, value)`), but counting only needs the
 * event name.
 */
export const nodeCacheStatsEventMap: StatsEventMap = {
	set: "sets",
	del: "deletes",
	flush: "clears",
};

/**
 * Event map for `cache-manager` instances. `cache-manager` emits `get` on
 * every read (hit and miss), carrying `value` on a hit; hit/miss is therefore
 * derived from the payload. Note: `get` can fire multiple times per read across
 * store layers, so these counts are best-effort.
 */
export const cacheManagerStatsEventMap: StatsEventMap = {
	get: (stats: Stats, payload?: { value?: unknown; error?: unknown }) => {
		stats.increment("gets");
		if (payload && payload.value !== undefined) {
			stats.increment("hits");
		} else {
			stats.increment("misses");
		}
	},
	set: "sets",
	mset: "sets",
	del: "deletes",
	mdel: "deletes",
	clear: "clears",
};

type StatsSubscription = {
	emitter: StatsEmitter;
	event: string;
	listener: (...args: any[]) => void;
};

export class Stats {
	private _counters: Record<StatField, number> = {
		hits: 0,
		misses: 0,
		gets: 0,
		sets: 0,
		deletes: 0,
		clears: 0,
		count: 0,
	};

	private _vsize = 0;
	private _ksize = 0;
	private _enabled = false;
	private _lastUpdated: number | undefined;
	private _lastReset: number | undefined;
	private _subscriptions: StatsSubscription[] = [];

	constructor(options?: StatsOptions) {
		if (options?.enabled) {
			this._enabled = options.enabled;
		}

		if (options?.emitter) {
			this.subscribe(options.emitter, options.eventMap);
		}
	}

	/**
	 * @returns {boolean} - Whether the stats are enabled
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	/**
	 * @param {boolean} enabled - Whether to enable the stats
	 */
	public set enabled(enabled: boolean) {
		this._enabled = enabled;
	}

	/**
	 * @returns {number} - The number of hits
	 * @readonly
	 */
	public get hits(): number {
		return this._counters.hits;
	}

	/**
	 * @returns {number} - The number of misses
	 * @readonly
	 */
	public get misses(): number {
		return this._counters.misses;
	}

	/**
	 * @returns {number} - The number of gets
	 * @readonly
	 */
	public get gets(): number {
		return this._counters.gets;
	}

	/**
	 * @returns {number} - The number of sets
	 * @readonly
	 */
	public get sets(): number {
		return this._counters.sets;
	}

	/**
	 * @returns {number} - The number of deletes
	 * @readonly
	 */
	public get deletes(): number {
		return this._counters.deletes;
	}

	/**
	 * @returns {number} - The number of clears
	 * @readonly
	 */
	public get clears(): number {
		return this._counters.clears;
	}

	/**
	 * @returns {number} - The vsize (value size) of the cache instance
	 * @readonly
	 */
	public get vsize(): number {
		return this._vsize;
	}

	/**
	 * @returns {number} - The ksize (key size) of the cache instance
	 * @readonly
	 */
	public get ksize(): number {
		return this._ksize;
	}

	/**
	 * @returns {number} - The count of the cache instance
	 * @readonly
	 */
	public get count(): number {
		return this._counters.count;
	}

	/**
	 * The ratio of hits to total lookups (hits + misses). Returns `0` when there
	 * have been no lookups.
	 * @returns {number} - A value between 0 and 1
	 * @readonly
	 */
	public get hitRate(): number {
		const total = this._counters.hits + this._counters.misses;
		return total === 0 ? 0 : this._counters.hits / total;
	}

	/**
	 * The ratio of misses to total lookups (hits + misses). Returns `0` when
	 * there have been no lookups.
	 * @returns {number} - A value between 0 and 1
	 * @readonly
	 */
	public get missRate(): number {
		const total = this._counters.hits + this._counters.misses;
		return total === 0 ? 0 : this._counters.misses / total;
	}

	/**
	 * The timestamp (ms since epoch) of the last mutation while enabled, or
	 * `undefined` if there have been none since the last reset.
	 * @returns {number | undefined}
	 * @readonly
	 */
	public get lastUpdated(): number | undefined {
		return this._lastUpdated;
	}

	/**
	 * The timestamp (ms since epoch) of the last {@link reset}/{@link clear}, or
	 * `undefined` if it has never been reset.
	 * @returns {number | undefined}
	 * @readonly
	 */
	public get lastReset(): number | undefined {
		return this._lastReset;
	}

	/**
	 * Increment a counter field by `amount` (default `1`). No-op when disabled.
	 * @param {StatField} field - The counter to increment
	 * @param {number} amount - The amount to add (default 1)
	 */
	public increment(field: StatField, amount = 1): void {
		if (!this._enabled) {
			return;
		}

		this._counters[field] += amount;
		this.touch();
	}

	/**
	 * Decrement a counter field by `amount` (default `1`). No-op when disabled.
	 * @param {StatField} field - The counter to decrement
	 * @param {number} amount - The amount to subtract (default 1)
	 */
	public decrement(field: StatField, amount = 1): void {
		if (!this._enabled) {
			return;
		}

		this._counters[field] -= amount;
		this.touch();
	}

	public incrementHits(amount = 1): void {
		this.increment("hits", amount);
	}

	public incrementMisses(amount = 1): void {
		this.increment("misses", amount);
	}

	public incrementGets(amount = 1): void {
		this.increment("gets", amount);
	}

	public incrementSets(amount = 1): void {
		this.increment("sets", amount);
	}

	public incrementDeletes(amount = 1): void {
		this.increment("deletes", amount);
	}

	public incrementClears(amount = 1): void {
		this.increment("clears", amount);
	}

	public incrementVSize(value: any): void {
		if (!this._enabled) {
			return;
		}

		this._vsize += this.roughSizeOfObject(value);
		this.touch();
	}

	public decreaseVSize(value: any): void {
		if (!this._enabled) {
			return;
		}

		this._vsize -= this.roughSizeOfObject(value);
		this.touch();
	}

	public incrementKSize(key: string): void {
		if (!this._enabled) {
			return;
		}

		this._ksize += this.roughSizeOfString(key);
		this.touch();
	}

	public decreaseKSize(key: string): void {
		if (!this._enabled) {
			return;
		}

		this._ksize -= this.roughSizeOfString(key);
		this.touch();
	}

	public incrementCount(amount = 1): void {
		this.increment("count", amount);
	}

	public decreaseCount(amount = 1): void {
		this.decrement("count", amount);
	}

	public setCount(count: number): void {
		if (!this._enabled) {
			return;
		}

		this._counters.count = count;
		this.touch();
	}

	public roughSizeOfString(value: string): number {
		// Keys are strings (UTF-16)
		return value.length * 2;
	}

	public roughSizeOfObject(object: any): number {
		const objectList: any[] = [];
		const stack: any[] = [object];
		let bytes = 0;

		while (stack.length > 0) {
			const value = stack.pop();

			if (typeof value === "boolean") {
				bytes += 4; // Booleans are 4 bytes
			} else if (typeof value === "string") {
				bytes += value.length * 2; // Each character is 2 bytes (UTF-16 encoding)
			} else if (typeof value === "number") {
				bytes += 8; // Numbers are 8 bytes (IEEE 754 format)
			} else {
				// Handle null values
				if (value === null || value === undefined) {
					bytes += 4;
					continue;
				}

				// Check for circular references - if this object was already processed, skip it
				if (objectList.includes(value)) {
					continue;
				}

				// object as default
				objectList.push(value);

				// Estimate object overhead, and then recursively estimate the size of properties
				for (const key in value) {
					bytes += key.length * 2; // Keys are strings (UTF-16)
					stack.push(value[key]); // Add values to the stack to compute their size
				}
			}
		}

		return bytes;
	}

	/**
	 * Enable stat tracking. Equivalent to setting {@link enabled} to `true`.
	 */
	public enable(): void {
		this._enabled = true;
	}

	/**
	 * Disable stat tracking. Equivalent to setting {@link enabled} to `false`.
	 */
	public disable(): void {
		this._enabled = false;
	}

	/**
	 * Reset all counters to zero and record the reset timestamp. Alias of
	 * {@link reset}.
	 */
	public clear(): void {
		this.reset();
	}

	public reset(): void {
		this._counters = {
			hits: 0,
			misses: 0,
			gets: 0,
			sets: 0,
			deletes: 0,
			clears: 0,
			count: 0,
		};
		this._vsize = 0;
		this._ksize = 0;
		this._lastReset = Date.now();
		this._lastUpdated = undefined;
	}

	public resetStoreValues(): void {
		this._vsize = 0;
		this._ksize = 0;
		this._counters.count = 0;
	}

	/**
	 * @returns {StatsSnapshot} - A plain-object snapshot of the current stats,
	 * including computed `hitRate`/`missRate` and timestamps.
	 */
	public toJSON(): StatsSnapshot {
		return {
			enabled: this._enabled,
			hits: this._counters.hits,
			misses: this._counters.misses,
			gets: this._counters.gets,
			sets: this._counters.sets,
			deletes: this._counters.deletes,
			clears: this._counters.clears,
			vsize: this._vsize,
			ksize: this._ksize,
			count: this._counters.count,
			hitRate: this.hitRate,
			missRate: this.missRate,
			lastUpdated: this._lastUpdated,
			lastReset: this._lastReset,
		};
	}

	/**
	 * @returns {StatsSnapshot} - A plain-object snapshot of the current stats.
	 * Alias of {@link toJSON}.
	 */
	public snapshot(): StatsSnapshot {
		return this.toJSON();
	}

	/**
	 * Subscribe to an emitter so that matching events automatically update the
	 * stats. Counting is gated by {@link enabled}, so you may subscribe first and
	 * toggle enablement later. Call {@link unsubscribe} to detach.
	 * @param {StatsEmitter} emitter - The emitter to listen on
	 * @param {StatsEventMap} eventMap - The event-to-stat mapping (defaults to
	 * {@link cacheableStatsEventMap})
	 */
	public subscribe(
		emitter: StatsEmitter,
		eventMap: StatsEventMap = cacheableStatsEventMap,
	): void {
		for (const [event, action] of Object.entries(eventMap)) {
			const listener = (...args: any[]): void => {
				this.applyEvent(action, args);
			};

			emitter.on(event, listener);
			this._subscriptions.push({ emitter, event, listener });
		}
	}

	/**
	 * Detach listeners previously attached via {@link subscribe}. When `emitter`
	 * is provided, only that emitter's listeners are removed; otherwise all are.
	 * @param {StatsEmitter} [emitter] - The emitter to detach from
	 */
	public unsubscribe(emitter?: StatsEmitter): void {
		const remaining: StatsSubscription[] = [];

		for (const sub of this._subscriptions) {
			if (emitter && sub.emitter !== emitter) {
				remaining.push(sub);
				continue;
			}

			const off = sub.emitter.off ?? sub.emitter.removeListener;
			off?.call(sub.emitter, sub.event, sub.listener);
		}

		this._subscriptions = remaining;
	}

	private applyEvent(
		action: StatField | StatField[] | StatsEventHandler,
		args: any[],
	): void {
		if (typeof action === "function") {
			action(this, ...args);
			return;
		}

		if (Array.isArray(action)) {
			for (const field of action) {
				this.increment(field);
			}

			return;
		}

		this.increment(action);
	}

	private touch(): void {
		this._lastUpdated = Date.now();
	}
}
