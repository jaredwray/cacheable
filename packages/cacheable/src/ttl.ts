import {shorthandToMilliseconds} from '../src/shorthand-time.js';

/**
 * Converts a exspires value to a TTL value.
 * @param expires - The expires value to convert.
 * @returns {number | undefined} The TTL value in milliseconds, or undefined if the expires value is not valid.
 */
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

/**
 * Get the TTL value from the cacheableTtl, primaryTtl, and secondaryTtl values.
 * @param cacheableTtl - The cacheableTtl value to use.
 * @param primaryTtl - The primaryTtl value to use.
 * @param secondaryTtl - The secondaryTtl value to use.
 * @returns {number | undefined} The TTL value in milliseconds, or undefined if all values are undefined.
 */
export function getCascadingTtl(cacheableTtl?: number | string, primaryTtl?: number, secondaryTtl?: number): number | undefined {
	return secondaryTtl ?? primaryTtl ?? shorthandToMilliseconds(cacheableTtl);
}

/**
 * Calculate the TTL value from the expires value. If the ttl is undefined, it will be set to the expires value. If the
 * expires value is undefined, it will be set to the ttl value. If both values are defined, the smaller of the two will be used.
 * @param ttl
 * @param expires
 * @returns
 */
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
