import type { Keyv, KeyvStoreAdapter } from "keyv";

export enum CacheableHooks {
	BEFORE_SET = "BEFORE_SET",
	AFTER_SET = "AFTER_SET",
	BEFORE_SET_MANY = "BEFORE_SET_MANY",
	AFTER_SET_MANY = "AFTER_SET_MANY",
	BEFORE_GET = "BEFORE_GET",
	AFTER_GET = "AFTER_GET",
	BEFORE_GET_MANY = "BEFORE_GET_MANY",
	AFTER_GET_MANY = "AFTER_GET_MANY",
	BEFORE_SECONDARY_SETS_PRIMARY = "BEFORE_SECONDARY_SETS_PRIMARY",
}

export enum CacheableEvents {
	ERROR = "error",
	CACHE_HIT = "cache:hit",
	CACHE_MISS = "cache:miss",
}

export type CacheableOptions = {
	/**
	 * The primary store for the cacheable instance
	 */
	primary?: Keyv | KeyvStoreAdapter;
	/**
	 * The secondary store for the cacheable instance
	 */
	secondary?: Keyv | KeyvStoreAdapter;
	/**
	 * Whether to enable statistics for the cacheable instance
	 */
	stats?: boolean;
	/**
	 * Whether the secondary store is non-blocking mode. It is set to false by default.
	 * If it is set to true then the secondary store will not block the primary store.
	 */
	nonBlocking?: boolean;
	/**
	 * The time-to-live for the cacheable instance and will be used as the default value.
	 * can be a number in milliseconds or a human-readable format such as `1s` for 1 second or `1h` for 1 hour
	 * or undefined if there is no time-to-live.
	 */
	ttl?: number | string;
	/**
	 * The namespace for the cacheable instance. It can be a string or a function that returns a string.
	 */
	namespace?: string | (() => string);
	/**
	 * The cacheId for the cacheable instance. This is primarily used for the wrap function to not have conflicts.
	 * If it is not set then it will be a random string that is generated
	 */
	cacheId?: string;

	/**
	 * Stringifies an object into a string representation. This is used in many places such as Keyv, hashing, and creating cache keys. If
	 * you are storing complex objects that JSON.stringify does not handle well, you may want to provide your own implementation.
	 * @param object The object to stringify.
	 * @default undefined
	 * @returns The string representation of the object.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: type format
	serialize?: (object: any) => string;

	/**
	 * Parses a string back into an object. This is used in many places such as Keyv. If you provide your own
	 * stringify function, you should also provide a parse function that is the inverse of the stringify function.
	 * @param text The string to parse.
	 * @default undefined
	 * @returns The parsed object.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: type format
	deserialize?: (text: string) => any;
};

// biome-ignore lint/suspicious/noExplicitAny: type format
export type SerializationFunction = (object: any) => string;
// biome-ignore lint/suspicious/noExplicitAny: type format
export type DeserializationFunction = (text: string) => any;
