
export type StatsOptions = {
	enabled?: boolean;
};

export class Stats {
	private _hits = 0;
	private _misses = 0;
	private _gets = 0;
	private _sets = 0;
	private _deletes = 0;
	private _clears = 0;
	private _vsize = 0;
	private _ksize = 0;
	private _count = 0;
	private _enabled = false;

	constructor(options?: StatsOptions) {
		if (options?.enabled) {
			this._enabled = options.enabled;
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
		return this._hits;
	}

	/**
	 * @returns {number} - The number of misses
	 * @readonly
	 */
	public get misses(): number {
		return this._misses;
	}

	/**
	 * @returns {number} - The number of gets
	 * @readonly
	 */
	public get gets(): number {
		return this._gets;
	}

	/**
	 * @returns {number} - The number of sets
	 * @readonly
	 */
	public get sets(): number {
		return this._sets;
	}

	/**
	 * @returns {number} - The number of deletes
	 * @readonly
	 */
	public get deletes(): number {
		return this._deletes;
	}

	/**
	 * @returns {number} - The number of clears
	 * @readonly
	 */
	public get clears(): number {
		return this._clears;
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
		return this._count;
	}

	public incrementHits(): void {
		if (!this._enabled) {
			return;
		}

		this._hits++;
	}

	public incrementMisses(): void {
		if (!this._enabled) {
			return;
		}

		this._misses++;
	}

	public incrementGets(): void {
		if (!this._enabled) {
			return;
		}

		this._gets++;
	}

	public incrementSets(): void {
		if (!this._enabled) {
			return;
		}

		this._sets++;
	}

	public incrementDeletes(): void {
		if (!this._enabled) {
			return;
		}

		this._deletes++;
	}

	public incrementClears(): void {
		if (!this._enabled) {
			return;
		}

		this._clears++;
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public incrementVSize(value: any): void {
		if (!this._enabled) {
			return;
		}

		this._vsize += this.roughSizeOfObject(value);
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public decreaseVSize(value: any): void {
		if (!this._enabled) {
			return;
		}

		this._vsize -= this.roughSizeOfObject(value);
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public incrementKSize(key: string): void {
		if (!this._enabled) {
			return;
		}

		this._ksize += this.roughSizeOfString(key);
	}

	// eslint-disable-next-line @typescript-eslint/naming-convention
	public decreaseKSize(key: string): void {
		if (!this._enabled) {
			return;
		}

		this._ksize -= this.roughSizeOfString(key);
	}

	public incrementCount(): void {
		if (!this._enabled) {
			return;
		}

		this._count++;
	}

	public decreaseCount(): void {
		if (!this._enabled) {
			return;
		}

		this._count--;
	}

	public setCount(count: number): void {
		if (!this._enabled) {
			return;
		}

		this._count = count;
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

	public reset(): void {
		this._hits = 0;
		this._misses = 0;
		this._gets = 0;
		this._sets = 0;
		this._deletes = 0;
		this._clears = 0;
		this._vsize = 0;
		this._ksize = 0;
		this._count = 0;
	}

	public resetStoreValues(): void {
		this._vsize = 0;
		this._ksize = 0;
		this._count = 0;
	}
}
