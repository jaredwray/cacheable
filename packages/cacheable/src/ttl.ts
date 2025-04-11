import {shorthandToMilliseconds} from '../src/shorthand-time.js';

export function getTtlFromExpires(expires: number | undefined): number | undefined {
	if (expires === undefined || expires === null) {
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

export function calculateTtlFromExpiration(ttl: number | undefined, expires: number | undefined): number | undefined {
	const ttlFromExpires = getTtlFromExpires(expires);
	const expiresFromTtl = ttl ? Date.now() + ttl : undefined;
	if (ttlFromExpires === undefined) {
		return ttl;
	}

	if (expiresFromTtl === undefined) {
		return ttlFromExpires;
	}

	if (expires! > expiresFromTtl) {
		return ttl;
	}

	return ttlFromExpires;
}
