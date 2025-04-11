import {shorthandToMilliseconds} from '../src/shorthand-time.js';

export function getTtlFromExpires(expires: number | undefined): number | undefined {
	if (expires === undefined) {
		return undefined;
	}

	const now = Date.now();
	if (expires < now) {
		return undefined;
	}

	return expires - now;
}

export function getCascadingTtl(cacheableTtl?: number | string, primaryTtl?: number, secondaryTtl?: number): number | undefined {
	return secondaryTtl ?? primaryTtl ?? shorthandToMilliseconds(cacheableTtl);
}
