/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import eventemitter from 'eventemitter3';

export type NodeCacheOptions = {
	stdTTL?: number; // The standard ttl as number in seconds for every generated cache element. 0 = unlimited
	checkperiod?: number; // Default is 600
	useClones?: boolean; // Default is true
	deleteOnExpire?: boolean; // Default is true
	maxKeys?: number; // Default is -1
};

export type NodeCacheItem = {
	key: string | number;
	value: any;
	ttl?: number;
};

export enum NodeCacheErrors {
	ECACHEFULL = 'Cache max keys amount exceeded',
	EKEYTYPE = 'The key argument has to be of type `string` or `number`. Found: `__key`',
	EKEYSTYPE = 'The keys argument has to be an array.',
	ETTLTYPE = 'The ttl argument has to be a number.',
}

export type NodeCacheStats = {
	keys: number; // global key count
	hits: number; // global hit count
	misses: number; // global miss count
	ksize: number; // global key size count in approximately bytes
	vsize: number; // global value size count in approximately bytes
};

export default class NodeCache extends eventemitter {
	public readonly options: NodeCacheOptions = {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		stdTTL: 0,
		checkperiod: 600,
		useClones: true,
		deleteOnExpire: true,
		maxKeys: -1,
	};

	public readonly store = new Map<string, any>();

	private _stats: NodeCacheStats = {
		keys: 0,
		hits: 0,
		misses: 0,
		ksize: 0,
		vsize: 0,
	};

	private intervalId: number | NodeJS.Timeout = 0;

	constructor(options?: NodeCacheOptions) {
		super();

		if (options) {
			this.options = {...this.options, ...options};
		}

		this.startInterval();
	}

	// Sets a key value pair. It is possible to define a ttl (in seconds). Returns true on success.
	public set(key: string | number, value: any, ttl?: number): boolean {
		// Check on key type
		/* c8 ignore next 3 */
		if (typeof key !== 'string' && typeof key !== 'number') {
			throw this.createError(NodeCacheErrors.EKEYTYPE, key);
		}

		// Check on ttl type
		/* c8 ignore next 3 */
		if (ttl && typeof ttl !== 'number') {
			throw this.createError(NodeCacheErrors.ETTLTYPE, this.formatKey(key));
		}

		const keyValue = this.formatKey(key);
		const ttlValue = ttl ?? this.options.stdTTL;
		let expirationTimestamp = 0; // Never delete
		if (ttlValue && ttlValue > 0) {
			expirationTimestamp = this.getExpirationTimestamp(ttlValue);
		}

		// Check on max key size
		if (this.options.maxKeys) {
			const maxKeys = this.options.maxKeys;
			if (maxKeys > -1 && this.store.size >= maxKeys) {
				throw this.createError(NodeCacheErrors.ECACHEFULL, this.formatKey(key));
			}
		}

		this.store.set(keyValue, {key: keyValue, value, ttl: expirationTimestamp});

		// Event
		this.emit('set', keyValue, value, ttlValue);

		// Add the bytes to the stats
		this._stats.ksize += this.roughSizeOfKey(keyValue);
		this._stats.vsize += this.roughSizeOfObject(value);
		this._stats.keys = this.store.size;
		return true;
	}

	// Sets multiple key val pairs. It is possible to define a ttl (seconds). Returns true on success.
	public mset(data: NodeCacheItem[]): boolean {
		// Check on keys type
		/* c8 ignore next 3 */
		if (!Array.isArray(data)) {
			throw this.createError(NodeCacheErrors.EKEYSTYPE);
		}

		for (const item of data) {
			this.set(item.key, item.value, item.ttl);
		}

		return true;
	}

	// Gets a saved value from the cache. Returns a undefined if not found or expired. If the value was found it returns the value.
	public get(key: string | number): any {
		const result = this.store.get(this.formatKey(key));
		if (result) {
			if (result.ttl > 0) {
				if (result.ttl < Date.now()) {
					if (this.options.deleteOnExpire) {
						this.del(key);
					}

					this.addMiss();
					// Event
					this.emit('expired', this.formatKey(key), result.value);
					return undefined;
				}

				this.addHit();
				if (this.options.useClones) {
					return this.clone(result.value);
				}

				return result.value;
			}

			this.addHit();
			if (this.options.useClones) {
				return this.clone(result.value);
			}

			return result.value;
		}

		this.addMiss();
		return undefined;
	}

	/*
		Gets multiple saved values from the cache. Returns an empty object {} if not found or expired.
		If the value was found it returns an object with the key value pair.
	*/
	public mget(keys: Array<string | number>): Record<string, unknown> {
		const result: Record<string, unknown> = {};

		for (const key of keys) {
			const value = this.get(key);
			if (value) {
				result[this.formatKey(key)] = value;
			}
		}

		return result;
	}

	/*
		Get the cached value and remove the key from the cache.
		Equivalent to calling get(key) + del(key).
		Useful for implementing single use mechanism such as OTP, where once a value is read it will become obsolete.
	*/
	public take(key: string | number): any {
		const result = this.get(key);

		if (result) {
			this.del(key);
			if (this.options.useClones) {
				return this.clone(result);
			}

			return result;
		}

		return undefined;
	}

	// Delete a key. Returns the number of deleted entries. A delete will never fail.
	public del(key: string | number | Array<string | number>): number {
		if (Array.isArray(key)) {
			return this.mdel(key);
		}

		const result = this.store.get(this.formatKey(key));
		if (result) {
			const keyValue = this.formatKey(key);
			this.store.delete(keyValue);

			// Event
			this.emit('del', keyValue, result.value);

			// Remove the bytes from the stats
			this._stats.ksize -= this.roughSizeOfKey(keyValue);
			this._stats.vsize -= this.roughSizeOfObject(result.value);
			this._stats.keys = this.store.size;
			return 1;
		}

		return 0;
	}

	// Delete all keys in Array that exist. Returns the number of deleted entries.
	public mdel(keys: Array<string | number>): number {
		let result = 0;
		for (const key of keys) {
			result += this.del(key);
		}

		return result;
	}

	// Redefine the ttl of a key. Returns true if the key has been found and changed.
	// Otherwise returns false. If the ttl-argument isn't passed the default-TTL will be used.
	public ttl(key: string | number, ttl?: number): boolean {
		const result = this.store.get(this.formatKey(key));
		if (result) {
			const ttlValue = ttl ?? this.options.stdTTL!;
			result.ttl = this.getExpirationTimestamp(ttlValue);
			this.store.set(this.formatKey(key), result);
			return true;
		}

		return false;
	}

	/*
		Receive the ttl of a key. You will get:

		undefined if the key does not exist
		0 if this key has no ttl
		a timestamp in ms representing the time at which the key will expire
	*/

	public getTtl(key: string | number): number | undefined {
		const result = this.store.get(this.formatKey(key));
		if (result) {
			if (result.ttl === 0) {
				return 0;
			}

			return result.ttl as number;
		}

		return undefined;
	}

	/*
		Returns an array of all existing keys.
		[ "all", "my", "keys", "foo", "bar" ]
	*/
	public keys(): string[] {
		const result: string[] = [];

		for (const key of this.store.keys()) {
			result.push(key);
		}

		return result;
	}

	// Returns boolean indicating if the key is cached.
	public has(key: string | number): boolean {
		return this.store.has(this.formatKey(key));
	}

	// Gets the stats of the cache.
	public getStats(): NodeCacheStats {
		return this._stats;
	}

	// Flush the whole data.
	public flushAll(): void {
		this.store.clear();
		this.flushStats();
		// Event
		this.emit('flush');
	}

	// Flush the stats
	public flushStats(): void {
		this._stats = {
			keys: 0,
			hits: 0,
			misses: 0,
			ksize: 0,
			vsize: 0,
		};

		// Event
		this.emit('flush_stats');
	}

	// Close the cache. This will clear the interval timeout which is set on check period option.
	public close(): void {
		this.stopInterval();
	}

	// Get the interval id
	public getIntervalId(): number | NodeJS.Timeout {
		return this.intervalId;
	}

	private formatKey(key: string | number): string {
		return key.toString();
	}

	private getExpirationTimestamp(ttlInSeconds: number): number {
		const currentTimestamp = Date.now(); // Current time in milliseconds
		const ttlInMilliseconds = ttlInSeconds * 1000; // Convert TTL to milliseconds
		const expirationTimestamp = currentTimestamp + ttlInMilliseconds;
		return expirationTimestamp;
	}

	private addHit(): void {
		this._stats.hits++;
	}

	private addMiss(): void {
		this._stats.misses++;
	}

	private roughSizeOfKey(key: string): number {
		// Keys are strings (UTF-16)
		return this.formatKey(key).toString().length * 2;
	}

	private roughSizeOfObject(object: any): number {
		const objectList: any[] = [];
		const stack: any[] = [object];
		let bytes = 0;

		while (stack.length > 0) {
			const value = stack.pop();

			if (typeof value === 'boolean') {
				bytes += 4; // Booleans are 4 bytes
			} else if (typeof value === 'string') {
				bytes += value.length * 2; // Each character is 2 bytes (UTF-16 encoding)
			} else if (typeof value === 'number') {
				bytes += 8; // Numbers are 8 bytes (IEEE 754 format)
			} else if (typeof value === 'object' && value !== null && !objectList.includes(value)) {
				objectList.push(value);

				// Estimate object overhead, and then recursively estimate the size of properties
				// eslint-disable-next-line guard-for-in
				for (const key in value) {
					bytes += key.length * 2; // Keys are strings (UTF-16)
					stack.push(value[key]); // Add values to the stack to compute their size
				}
			}
		}

		return bytes;
	}

	private startInterval(): void {
		if (this.options.checkperiod && this.options.checkperiod > 0) {
			const checkPeriodinSeconds = this.options.checkperiod * 1000;
			this.intervalId = setInterval(() => {
				this.checkData();
			}, checkPeriodinSeconds);

			return;
		}

		this.intervalId = 0;
	}

	private checkData(): void {
		for (const [key, value] of this.store.entries()) {
			if (value.ttl > 0 && value.ttl < Date.now()) {
				this.del(key);
			}
		}
	}

	private stopInterval(): void {
		if (this.intervalId !== 0) {
			clearInterval(this.intervalId);
			this.intervalId = 0;
		}
	}

	private createError(errorCode: string, key?: string): Error {
		let error = errorCode;
		/* c8 ignore next 3 */
		if (key) {
			error = error.replace('__key', key);
		}

		return new Error(error);
	}

	private isPrimitive(value: any): boolean {
		const result = false;

		/* c8 ignore next 3 */
		if (value === null || value === undefined) {
			return true;
		}

		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return true;
		}

		return result;
	}

	private clone(value: any): any {
		if (this.isPrimitive(value)) {
			return value;
		}

		return structuredClone(value);
	}
}

