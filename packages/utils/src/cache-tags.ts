import type { Keyv } from "keyv";

/**
 * Options for constructing a {@link CacheTags}.
 * @typedef {Object} CacheTagsOptions
 * @property {Keyv} store - The Keyv store used to persist tag versions and key snapshots.
 * @property {string} [namespace] - An optional namespace that isolates this service's tags
 * and keys from others sharing the same store. Defaults to `"default"`.
 * @property {boolean} [enabled] - Whether the service is enabled. When disabled, read methods
 * are no-ops ({@link CacheTags.isKeyFresh} returns `true`, {@link CacheTags.isKeyStale}
 * returns `false`, etc.) and snapshot writes/removals are skipped. Tag writes
 * ({@link CacheTags.setKeyTags}, {@link CacheTags.invalidateTag},
 * {@link CacheTags.invalidateTags}) automatically re-enable the service. Defaults to `true`.
 * @property {(error: unknown) => void} [onError] - Invoked with errors from non-blocking
 * (fire-and-forget) operations, which cannot be thrown to the caller. Defaults to ignoring them.
 */
export type CacheTagsOptions = {
	store: Keyv;
	namespace?: string;
	enabled?: boolean;
	onError?: (error: unknown) => void;
};

/**
 * Options for {@link CacheTags.setKeyTags}.
 * @typedef {Object} SetKeyTagsOptions
 * @property {number} [ttl] - Time-to-live in milliseconds for the key's tag snapshot. Should
 * match the TTL of the cached value it tracks so the snapshot expires alongside it. If omitted,
 * the snapshot does not expire.
 * @property {boolean} [nonBlocking] - When `true`, the snapshot write is fire-and-forget:
 * the call resolves immediately and failures are reported via the `onError` option.
 */
export type SetKeyTagsOptions = {
	ttl?: number;
	nonBlocking?: boolean;
};

/**
 * Options for {@link CacheTags.removeKey} and {@link CacheTags.removeKeys}.
 * @typedef {Object} RemoveKeysOptions
 * @property {boolean} [nonBlocking] - When `true`, the removal is fire-and-forget:
 * the call resolves immediately and failures are reported via the `onError` option.
 */
export type RemoveKeysOptions = {
	nonBlocking?: boolean;
};

/**
 * The metadata stored for a tagged key. It records the version of each tag at the moment the key
 * was written, allowing {@link CacheTags.isKeyFresh} to detect later invalidations.
 * @typedef {Object} KeyTagEntry
 * @property {Record<string, number>} tags - A snapshot mapping each tag name to its version at set time.
 */
export type KeyTagEntry = {
	tags: Record<string, number>;
};

/**
 * Prefix applied to every store key written by the service so its metadata cannot collide with
 * user-supplied cache keys.
 */
const RESERVED_PREFIX = "--cacheable--tags--";

/** Namespace used when none is supplied to the constructor. */
const DEFAULT_NAMESPACE = "default";

/**
 * Provides tag-based cache invalidation on top of any {@link Keyv} store. It is store-agnostic and
 * requires no adapter changes.
 *
 * The service uses a lazy invalidation model rather than scanning and deleting keys. Each tag has a
 * monotonically increasing version counter; {@link CacheTags.invalidateTag} simply increments
 * it. When a key is tagged via {@link CacheTags.setKeyTags}, a snapshot of its tags' current
 * versions is stored alongside it. {@link CacheTags.isKeyFresh} compares that snapshot against
 * the live versions — if any tag has been incremented since, the key is considered stale. Stale
 * entries are not deleted explicitly; they are expected to fall out of the cache via their TTL.
 *
 * This keeps invalidation constant-time regardless of how many keys reference a tag, at the cost of
 * one additional `isKeyFresh` read per cache lookup.
 *
 * The service can be disabled via the `enabled` option or property so integrations pay no cost for
 * untagged workloads: while disabled, read methods are no-ops and snapshot writes/removals are
 * skipped. Using a tag write ({@link CacheTags.setKeyTags}, {@link CacheTags.invalidateTag},
 * {@link CacheTags.invalidateTags}) automatically re-enables it.
 *
 * All metadata is written under a reserved prefix so it cannot collide with user keys:
 * - `--cacheable--tags--:<namespace>:tag:<tag>` → integer version counter (stored without TTL).
 * - `--cacheable--tags--:<namespace>:key:<key>` → the {@link KeyTagEntry} snapshot.
 *
 * Note: the read-version-then-write-snapshot sequence in `setKeyTags` is not atomic across
 * processes. A concurrent `invalidateTag` running between the read and the write can leave a freshly
 * written key referencing a stale version.
 *
 * @example
 * ```typescript
 * const cacheTags = new CacheTags({ store: new Keyv(), namespace: 'app' });
 * await cacheTags.setKeyTags('user:42', ['users', 'org:7'], { ttl: 3600000 });
 * await cacheTags.isKeyFresh('user:42'); // true
 * await cacheTags.invalidateTag('users');
 * await cacheTags.isKeyFresh('user:42'); // false
 * ```
 */
export class CacheTags {
	private readonly _store: Keyv;
	private readonly _namespace: string;
	private _enabled: boolean;
	private readonly _onError?: (error: unknown) => void;

	/**
	 * Creates a new tag service.
	 * @param {CacheTagsOptions} options - The store, optional namespace, enabled state, and
	 * non-blocking error handler to use.
	 */
	constructor(options: CacheTagsOptions) {
		this._store = options.store;
		this._namespace = options.namespace ?? DEFAULT_NAMESPACE;
		this._enabled = options.enabled ?? true;
		this._onError = options.onError;
	}

	/**
	 * The Keyv store backing this service.
	 * @returns {Keyv} The store provided to the constructor.
	 */
	public get store(): Keyv {
		return this._store;
	}

	/**
	 * The namespace isolating this service's tags and keys within the store.
	 * @returns {string} The configured namespace, or `"default"` if none was provided.
	 */
	public get namespace(): string {
		return this._namespace;
	}

	/**
	 * Whether the service is enabled. While disabled, read methods are no-ops and snapshot
	 * writes/removals are skipped, so integrations pay no extra store reads for untagged
	 * workloads. Tag writes ({@link CacheTags.setKeyTags}, {@link CacheTags.invalidateTag},
	 * {@link CacheTags.invalidateTags}) automatically re-enable the service.
	 * @returns {boolean} Whether the service is enabled.
	 */
	public get enabled(): boolean {
		return this._enabled;
	}

	/**
	 * Sets whether the service is enabled.
	 * @param {boolean} enabled Whether the service is enabled.
	 */
	public set enabled(enabled: boolean) {
		this._enabled = enabled;
	}

	/**
	 * Builds the reserved store key under which a tag's version counter is stored.
	 * @param tag - The tag name.
	 * @returns {string} The namespaced store key for the tag's version.
	 */
	private tagKey(tag: string): string {
		return `${RESERVED_PREFIX}:${this._namespace}:tag:${tag}`;
	}

	/**
	 * Builds the reserved store key under which a cache key's tag snapshot is stored.
	 * @param key - The cache key being tagged.
	 * @returns {string} The namespaced store key for the key's snapshot.
	 */
	private keyEntryKey(key: string): string {
		return `${RESERVED_PREFIX}:${this._namespace}:key:${key}`;
	}

	/**
	 * Builds the common prefix shared by every key-snapshot entry in this namespace. Used to filter
	 * key entries when iterating the store.
	 * @returns {string} The namespaced key-entry prefix.
	 */
	private keyPrefix(): string {
		return `${RESERVED_PREFIX}:${this._namespace}:key:`;
	}

	/**
	 * Reads the current version of a single tag.
	 * @param tag - The tag name.
	 * @returns {Promise<number>} The tag's version, or `0` if it has never been invalidated.
	 */
	private async getTagVersion(tag: string): Promise<number> {
		const version = await this._store.get<number>(this.tagKey(tag));
		return typeof version === "number" ? version : 0;
	}

	/**
	 * Reads the current versions of multiple tags in a single batched store read.
	 * @param tags - The tag names to look up.
	 * @returns {Promise<number[]>} The versions in the same order as `tags`; entries that have never
	 * been invalidated resolve to `0`. Returns an empty array when `tags` is empty.
	 */
	private async getTagVersions(tags: string[]): Promise<number[]> {
		if (tags.length === 0) {
			return [];
		}
		const tagKeys = tags.map((tag) => this.tagKey(tag));
		const raw = await this._store.get<number>(tagKeys);
		return tags.map((_, i) => {
			const value = raw?.[i];
			return typeof value === "number" ? value : 0;
		});
	}

	/**
	 * Reports a fire-and-forget failure to the `onError` handler, if one was provided.
	 * @param error - The error raised by the non-blocking operation.
	 */
	private handleNonBlockingError(error: unknown): void {
		this._onError?.(error);
	}

	/**
	 * Reads the version snapshot of each tag and writes the key's tag snapshot to the store.
	 * @param key - The cache key to tag.
	 * @param tags - The tags to associate with the key.
	 * @param ttl - Time-to-live in milliseconds for the snapshot.
	 * @returns {Promise<void>} Resolves once the snapshot has been written.
	 */
	private async writeKeyTags(
		key: string,
		tags: string[],
		ttl?: number,
	): Promise<void> {
		const uniqueTags = [...new Set(tags)];
		const versions = await this.getTagVersions(uniqueTags);
		const snapshot: Record<string, number> = {};
		for (let i = 0; i < uniqueTags.length; i++) {
			snapshot[uniqueTags[i]] = versions[i];
		}

		const entry: KeyTagEntry = { tags: snapshot };
		await this._store.set(this.keyEntryKey(key), entry, ttl);
	}

	/**
	 * Associates a cache key with a set of tags by recording a snapshot of each tag's current
	 * version. Call this whenever you write a fresh value to the cache. Duplicate tags are ignored.
	 * Automatically enables the service.
	 * @param key - The cache key to tag.
	 * @param tags - The tags to associate with the key.
	 * @param {SetKeyTagsOptions} [options] - Optional settings, such as a `ttl` for the snapshot or
	 * `nonBlocking` to fire-and-forget the write.
	 * @returns {Promise<void>} Resolves once the snapshot has been written, or immediately when
	 * `nonBlocking` is set.
	 */
	public async setKeyTags(
		key: string,
		tags: string[],
		options?: SetKeyTagsOptions,
	): Promise<void> {
		this._enabled = true;
		const work = this.writeKeyTags(key, tags, options?.ttl);
		if (options?.nonBlocking) {
			work.catch((error) => {
				this.handleNonBlockingError(error);
			});
			return;
		}

		await work;
	}

	/**
	 * Removes a key's tag snapshot. After this, {@link CacheTags.isKeyFresh} returns `false`
	 * for the key. Use when the cached value itself is deleted. No-op while the service is
	 * disabled.
	 * @param key - The cache key whose snapshot should be removed.
	 * @param {RemoveKeysOptions} [options] - Optional settings, such as `nonBlocking` to
	 * fire-and-forget the removal.
	 * @returns {Promise<void>} Resolves once the snapshot has been deleted, or immediately when
	 * `nonBlocking` is set.
	 */
	public async removeKey(
		key: string,
		options?: RemoveKeysOptions,
	): Promise<void> {
		await this.removeKeys([key], options);
	}

	/**
	 * Removes multiple keys' tag snapshots in a single batched store delete. After this,
	 * {@link CacheTags.isKeyFresh} returns `false` for each key. An empty list is a no-op, as is
	 * the entire call while the service is disabled.
	 * @param keys - The cache keys whose snapshots should be removed.
	 * @param {RemoveKeysOptions} [options] - Optional settings, such as `nonBlocking` to
	 * fire-and-forget the removal.
	 * @returns {Promise<void>} Resolves once the snapshots have been deleted, or immediately when
	 * `nonBlocking` is set.
	 */
	public async removeKeys(
		keys: string[],
		options?: RemoveKeysOptions,
	): Promise<void> {
		if (!this._enabled || keys.length === 0) {
			return;
		}

		const entryKeys = keys.map((key) => this.keyEntryKey(key));
		const work = this._store.deleteMany(entryKeys);
		if (options?.nonBlocking) {
			work.catch((error) => {
				this.handleNonBlockingError(error);
			});
			return;
		}

		await work;
	}

	/**
	 * Determines whether a key's cached value can still be trusted. A key is fresh only when a
	 * snapshot exists for it and every tag in that snapshot still has the version it had at set time.
	 * A key with no tags is trivially fresh. Call this before returning a value from your cache.
	 * Always returns `true` while the service is disabled.
	 * @param key - The cache key to check.
	 * @returns {Promise<boolean>} `true` if the key is still fresh; `false` if it is unknown or any of
	 * its tags has been invalidated since the snapshot was taken.
	 */
	public async isKeyFresh(key: string): Promise<boolean> {
		if (!this._enabled) {
			return true;
		}

		const entry = await this._store.get<KeyTagEntry>(this.keyEntryKey(key));
		if (!entry?.tags) {
			return false;
		}

		const tags = Object.keys(entry.tags);
		const currentVersions = await this.getTagVersions(tags);

		for (let i = 0; i < tags.length; i++) {
			if (currentVersions[i] !== entry.tags[tags[i]]) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Determines whether a key's cached value is known to be stale due to tag invalidation. This is
	 * the complement of {@link CacheTags.isKeyFresh} for tagged keys, but treats keys without a
	 * snapshot as not stale — making it safe to call for every cache lookup, including keys that were
	 * never tagged. Always returns `false` while the service is disabled.
	 * @param key - The cache key to check.
	 * @returns {Promise<boolean>} `true` only when a snapshot exists for the key and at least one of
	 * its tags has been invalidated since the snapshot was taken; `false` otherwise (including when
	 * the key has no snapshot).
	 */
	public async isKeyStale(key: string): Promise<boolean> {
		if (!this._enabled) {
			return false;
		}

		const staleKeys = await this.getStaleKeys([key]);
		return staleKeys.length > 0;
	}

	/**
	 * Determines which of the given keys are known to be stale due to tag invalidation, using two
	 * batched store reads regardless of how many keys are checked: one for the snapshots and one for
	 * the union of their tag versions. Keys without a snapshot are not considered stale. Returns an
	 * empty array while the service is disabled.
	 * @param keys - The cache keys to check.
	 * @returns {Promise<string[]>} The subset of `keys` whose snapshot references at least one tag
	 * that has been invalidated since the snapshot was taken.
	 */
	public async getStaleKeys(keys: string[]): Promise<string[]> {
		if (!this._enabled || keys.length === 0) {
			return [];
		}

		const entryKeys = keys.map((key) => this.keyEntryKey(key));
		const entries = await this._store.get<KeyTagEntry>(entryKeys);

		const tagSet = new Set<string>();
		for (const entry of entries) {
			if (entry?.tags) {
				for (const tag of Object.keys(entry.tags)) {
					tagSet.add(tag);
				}
			}
		}

		const tags = [...tagSet];
		const versions = await this.getTagVersions(tags);
		const currentVersions = new Map<string, number>();
		for (let i = 0; i < tags.length; i++) {
			currentVersions.set(tags[i], versions[i]);
		}

		const staleKeys: string[] = [];
		for (const [i, entry] of entries.entries()) {
			if (!entry?.tags) {
				continue;
			}
			for (const [tag, version] of Object.entries(entry.tags)) {
				if (currentVersions.get(tag) !== version) {
					staleKeys.push(keys[i]);
					break;
				}
			}
		}

		return staleKeys;
	}

	/**
	 * Returns the tags currently associated with a key. Returns `undefined` while the service is
	 * disabled.
	 * @param key - The cache key to look up.
	 * @returns {Promise<string[] | undefined>} The tag names from the key's snapshot, or `undefined`
	 * if the key has no snapshot.
	 */
	public async getTags(key: string): Promise<string[] | undefined> {
		if (!this._enabled) {
			return undefined;
		}

		const entry = await this._store.get<KeyTagEntry>(this.keyEntryKey(key));
		if (!entry?.tags) {
			return undefined;
		}

		return Object.keys(entry.tags);
	}

	/**
	 * Returns all cache keys whose snapshot references the given tag. This scans every key entry in
	 * the namespace via the Keyv iterator, making it an `O(N)` operation intended for debugging and
	 * tests rather than hot paths. Returns an empty array if the underlying store exposes no iterator
	 * or while the service is disabled.
	 * @param tag - The tag to search for.
	 * @returns {Promise<string[]>} The cache keys (with the reserved prefix stripped) referencing the tag.
	 */
	public async getKeysByTag(tag: string): Promise<string[]> {
		const result: string[] = [];
		if (!this._enabled) {
			return result;
		}

		const prefix = this.keyPrefix();
		const iterator = this._store.iterator?.(this._store.namespace);
		if (!iterator) {
			return result;
		}

		for await (const [storedKey, value] of iterator) {
			if (typeof storedKey !== "string" || !storedKey.startsWith(prefix)) {
				continue;
			}
			const entry = value as KeyTagEntry | undefined;
			if (entry?.tags && Object.hasOwn(entry.tags, tag)) {
				result.push(storedKey.slice(prefix.length));
			}
		}

		return result;
	}

	/**
	 * Invalidates a single tag by incrementing its version counter. Every key whose snapshot
	 * references this tag becomes stale immediately. Runs in constant time regardless of how many
	 * keys reference the tag. Automatically enables the service.
	 * @param tag - The tag to invalidate.
	 * @returns {Promise<string[]>} A single-element array containing the invalidated tag.
	 */
	public async invalidateTag(tag: string): Promise<string[]> {
		this._enabled = true;
		const current = await this.getTagVersion(tag);
		await this._store.set(this.tagKey(tag), current + 1);
		return [tag];
	}

	/**
	 * Invalidates multiple tags by incrementing each of their version counters in a single batched
	 * store write. Duplicate tags are bumped once. An empty list is a no-op. Automatically enables
	 * the service.
	 * @param tags - The tags to invalidate.
	 * @returns {Promise<string[]>} The `tags` argument as provided (including any duplicates).
	 */
	public async invalidateTags(tags: string[]): Promise<string[]> {
		const uniqueTags = [...new Set(tags)];
		if (uniqueTags.length === 0) {
			return tags;
		}

		this._enabled = true;
		const versions = await this.getTagVersions(uniqueTags);

		const kvPairs = [];
		for (let i = 0; i < uniqueTags.length; i++) {
			kvPairs.push({ key: this.tagKey(uniqueTags[i]), value: versions[i] + 1 });
		}

		await this._store.setMany(kvPairs);
		return tags;
	}
}
