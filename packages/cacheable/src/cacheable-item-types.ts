/**
 * CacheableItem
 * @typedef {Object} CacheableItem
 * @property {string} key - The key of the cacheable item
 * @property {any} value - The value of the cacheable item
 * @property {number|string} [ttl] - Time to Live - If you set a number it is miliseconds, if you set a string it is a human-readable
 * format such as `1s` for 1 second or `1h` for 1 hour. Setting undefined means that it will use the default time-to-live. If both are
 * undefined then it will not have a time-to-live.
 */
export type CacheableItem = {
	key: string;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	value: any;
	ttl?: number | string;
};

export type CacheableStoreItem = {
	key: string;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	value: any;
	expires?: number;
};
