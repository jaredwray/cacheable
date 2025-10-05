import { Hookified, type HookifiedOptions } from "hookified";
import { type MessageProvider, Qified } from "qified";

/**
 * Configuration options for CacheableSync
 */
export type CacheableSyncOptions = {
	/**
	 * Qified instance or message provider(s) for synchronization
	 */
	qified: Qified | MessageProvider | MessageProvider[];
} & HookifiedOptions;

/**
 * CacheableSync provides synchronization capabilities for cacheable items
 * using message providers from Qified
 */
export class CacheableSync extends Hookified {
	private _qified: Qified = new Qified();

	/**
	 * Creates an instance of CacheableSync
	 * @param options - Configuration options for CacheableSync
	 */
	constructor(options: CacheableSyncOptions) {
		super(options);

		this._qified = this.createQified(options.qified);
	}

	/**
	 * Gets the Qified instance used for synchronization
	 * @returns The Qified instance
	 */
	public get qified(): Qified {
		return this._qified;
	}

	/**
	 * Sets the Qified instance used for synchronization
	 * @param value - Either an existing Qified instance or MessageProvider(s)
	 */
	public set qified(value: Qified | MessageProvider | MessageProvider[]) {
		this._qified = this.createQified(value);
	}

	/**
	 * Creates or returns a Qified instance from the provided value
	 * @param value - Either an existing Qified instance or MessageProvider(s)
	 * @returns A Qified instance configured with the provided message provider(s)
	 */
	public createQified(
		value: Qified | MessageProvider | MessageProvider[],
	): Qified {
		if (value instanceof Qified) {
			return value;
		}

		const providers = Array.isArray(value) ? value : [value];
		return new Qified({ messageProviders: providers });
	}
}
