import {Hookified, type HookifiedOptions} from 'hookified';
import {Cacheable, type CacheableOptions} from 'cacheable';

export type CacheableNetOptions = {
	cache?: Cacheable | CacheableOptions;
} & HookifiedOptions;

export class CacheableNet extends Hookified {
	private _cache: Cacheable = new Cacheable();

	constructor(options?: CacheableNetOptions) {
		super(options);

		if (options?.cache) {
			this._cache = options.cache instanceof Cacheable ? options.cache : new Cacheable(options.cache);
		}
	}

	public get cache(): Cacheable {
		return this._cache;
	}

	public set cache(value: Cacheable) {
		this._cache = value;
	}
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Net = CacheableNet;
