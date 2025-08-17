// biome-ignore-all lint/suspicious/noExplicitAny: mock file
import type { CacheableStoreItem } from "@cacheable/utils";
import type { CacheInstance, CacheSyncInstance } from "../src/index.js";

export class MockCacheable implements CacheInstance {
	private readonly cache = new Map<string, CacheableStoreItem>();
	private readonly listeners: Record<string, Array<(...args: any[]) => void>> =
		{};

	async get(key: string): Promise<any | undefined> {
		const item = this.cache.get(key);
		if (item?.expires && Date.now() > item.expires) {
			this.cache.delete(key);
			return undefined;
		}

		return item?.value;
	}

	async has(key: string): Promise<boolean> {
		return (await this.get(key)) !== undefined;
	}

	async set(key: string, value: any, ttl?: number | string): Promise<void> {
		let expires: number | undefined;
		if (ttl && typeof ttl === "number" && ttl > 0) {
			expires = Date.now() + ttl;
		}

		this.cache.set(key, { key, value, expires });
	}

	on(event: string, listener: (...args: any[]) => void): void {
		this.listeners[event] ||= [];

		this.listeners[event].push(listener);
	}

	emit(event: string, ...args: any[]): boolean {
		const listeners = this.listeners[event];
		if (listeners) {
			for (const listener of listeners) {
				listener(...args);
			}
		}

		return true;
	}
}

export class MockCacheableMemory implements CacheSyncInstance {
	private readonly cache = new Map<string, CacheableStoreItem>();
	private readonly listeners: Record<string, Array<(...args: any[]) => void>> =
		{};

	get(key: string): any | undefined {
		const result = this.cache.get(key);
		if (result?.expires && Date.now() > result.expires) {
			this.cache.delete(key);
			return undefined;
		}

		return result?.value;
	}

	has(key: string): boolean {
		return this.get(key) !== undefined;
	}

	set(key: string, value: any, ttl?: number | string): void {
		let expires: number | undefined;
		if (ttl && typeof ttl === "number" && ttl > 0) {
			expires = Date.now() + ttl;
		}

		this.cache.set(key, { key, value, expires });
	}

	on(event: string, listener: (...args: any[]) => void): void {
		this.listeners[event] ||= [];
		this.listeners[event].push(listener);
	}

	emit(event: string, ...args: any[]): boolean {
		const listeners = this.listeners[event];
		if (listeners) {
			for (const listener of listeners) {
				listener(...args);
			}
		}

		return true;
	}
}
