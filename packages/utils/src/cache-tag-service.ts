import type { Keyv } from "keyv";

export type CacheTagServiceOptions = {
	store: Keyv;
	namespace?: string;
};

export type SetKeyTagsOptions = {
	ttl?: number;
};

export type KeyTagEntry = {
	tags: Record<string, number>;
};

const RESERVED_PREFIX = "--cacheable--tags--";
const DEFAULT_NAMESPACE = "default";

export class CacheTagService {
	private readonly _store: Keyv;
	private readonly _namespace: string;

	constructor(options: CacheTagServiceOptions) {
		this._store = options.store;
		this._namespace = options.namespace ?? DEFAULT_NAMESPACE;
	}

	public get store(): Keyv {
		return this._store;
	}

	public get namespace(): string {
		return this._namespace;
	}

	private tagKey(tag: string): string {
		return `${RESERVED_PREFIX}:${this._namespace}:tag:${tag}`;
	}

	private keyEntryKey(key: string): string {
		return `${RESERVED_PREFIX}:${this._namespace}:key:${key}`;
	}

	private keyPrefix(): string {
		return `${RESERVED_PREFIX}:${this._namespace}:key:`;
	}

	private async getTagVersion(tag: string): Promise<number> {
		const version = await this._store.get<number>(this.tagKey(tag));
		return typeof version === "number" ? version : 0;
	}

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

	public async setKeyTags(
		key: string,
		tags: string[],
		options?: SetKeyTagsOptions,
	): Promise<void> {
		const versions = await this.getTagVersions(tags);
		const snapshot: Record<string, number> = {};
		for (let i = 0; i < tags.length; i++) {
			snapshot[tags[i]] = versions[i];
		}

		const entry: KeyTagEntry = { tags: snapshot };
		await this._store.set(this.keyEntryKey(key), entry, options?.ttl);
	}

	public async removeKey(key: string): Promise<void> {
		await this._store.delete(this.keyEntryKey(key));
	}

	public async isKeyFresh(key: string): Promise<boolean> {
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
	 * Returns all keys referencing the given tag. O(N) — scans all key entries
	 * in this namespace via the Keyv iterator. Intended for debugging and tests.
	 */
	public async getKeysByTag(tag: string): Promise<string[]> {
		const result: string[] = [];
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

	public async invalidateTag(tag: string): Promise<string[]> {
		const current = await this.getTagVersion(tag);
		await this._store.set(this.tagKey(tag), current + 1);
		return [tag];
	}

	public async invalidateTags(tags: string[]): Promise<string[]> {
		if (tags.length === 0) {
			return tags;
		}
		const versions = await this.getTagVersions(tags);
		await this._store.setMany(
			tags.map((tag, i) => ({
				key: this.tagKey(tag),
				value: versions[i] + 1,
			})),
		);
		return tags;
	}
}
