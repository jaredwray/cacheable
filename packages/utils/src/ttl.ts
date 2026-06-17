import { shorthandToMilliseconds } from "../src/shorthand-time.js";

/**
 * A per-store time-to-live override. Each field is a normal TTL (a number in milliseconds or a
 * human-readable shorthand such as `1s`, `1m`, `1h`, `1d`) applied to that specific store. Fields
 * left undefined fall back to that store's own default TTL resolution.
 */
export type PerStoreTtl = {
	/**
	 * The time-to-live to use for the primary store.
	 */
	primary?: number | string;
	/**
	 * The time-to-live to use for the secondary store.
	 */
	secondary?: number | string;
};

/**
 * Normalizes a TTL input into per-store milliseconds. When given an object it resolves the
 * `primary` and `secondary` fields independently; when given a number or shorthand string it
 * applies the same value to both stores. Undefined fields (or undefined input) resolve to
 * `undefined` so the caller can fall back to its own default TTL.
 * @param ttl - The TTL input: a number (ms), a shorthand string, or a {@link PerStoreTtl} object.
 * @returns {{ primary?: number; secondary?: number }} The resolved per-store TTLs in milliseconds.
 */
export function resolvePerStoreTtl(ttl?: number | string | PerStoreTtl): {
	primary?: number;
	secondary?: number;
} {
	if (ttl !== null && typeof ttl === "object") {
		return {
			primary: shorthandToMilliseconds(ttl.primary),
			secondary: shorthandToMilliseconds(ttl.secondary),
		};
	}

	const milliseconds = shorthandToMilliseconds(ttl);
	return { primary: milliseconds, secondary: milliseconds };
}

/**
 * Converts a exspires value to a TTL value.
 * @param expires - The expires value to convert.
 * @returns {number | undefined} The TTL value in milliseconds, or undefined if the expires value is not valid.
 */
export function getTtlFromExpires(
	expires: number | undefined,
): number | undefined {
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
export function getCascadingTtl(
	cacheableTtl?: number | string,
	primaryTtl?: number,
	secondaryTtl?: number,
): number | undefined {
	return secondaryTtl ?? primaryTtl ?? shorthandToMilliseconds(cacheableTtl);
}

/**
 * Calculate the TTL value from the expires value. If the ttl is undefined, it will be set to the expires value. If the
 * expires value is undefined, it will be set to the ttl value. If both values are defined, the smaller of the two will be used.
 * @param ttl
 * @param expires
 * @returns
 */
export function calculateTtlFromExpiration(
	ttl: number | undefined,
	expires: number | undefined,
): number | undefined {
	const ttlFromExpires = getTtlFromExpires(expires);
	const expiresFromTtl = ttl ? Date.now() + ttl : undefined;
	if (ttlFromExpires === undefined) {
		return ttl;
	}

	if (expiresFromTtl === undefined) {
		return ttlFromExpires;
	}

	if (expires && expires > expiresFromTtl) {
		return ttl;
	}

	return ttlFromExpires;
}
