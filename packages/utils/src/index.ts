export {
	shorthandToMilliseconds,
	shorthandToTime,
} from "../src/shorthand-time.js";
export type {
	CacheableItem,
	CacheableStoreItem,
} from "./cacheable-item-types.js";
export { coalesceAsync } from "./coalesce-async.js";
export { HashAlgorithm, hash, hashToNumber } from "./hash.js";
export { isKeyvInstance } from "./is-keyv-instance.js";
export { isObject } from "./is-object.js";
export { lessThan } from "./less-than.js";
export { runIfFn } from "./run-if-fn.js";
export { sleep } from "./sleep.js";
export { Stats, type StatsOptions } from "./stats.js";
export {
	calculateTtlFromExpiration,
	getCascadingTtl,
	getTtlFromExpires,
} from "./ttl.js";

export {
	getOrSet, wrap
} from "./memoize.js";
