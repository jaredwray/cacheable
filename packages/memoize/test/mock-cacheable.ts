import {type CacheInstance, type CacheSyncInstance} from '../src/index.js';

export class MockCacheable implements CacheInstance<any> {
	private cache: Record<string, any> = {};

	async get(key: string): Promise<any | undefined> {
		return this.cache[key];
	}

	async has(key: string): Promise<boolean> {
		return key in this.cache;
	}

	async set(key: string, value: any, ttl?: number | string): Promise<boolean> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this.cache[key] = value;
		return true;
	}

	on(event: string, listener: (...args: any[]) => void): void {
		// Mock implementation
	}

	emit(event: string, ...args: any[]): boolean {
		// Mock implementation
		return true;
	}
}

export class MockCacheableMemory implements CacheSyncInstance<any> {
	private cache: Record<string, any> = {};

	get(key: string): any | undefined {
		return this.cache[key];
	}

	has(key: string): boolean {
		return key in this.cache;
	}

	set(key: string, value: any, ttl?: number | string): boolean {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		this.cache[key] = value;
		return true;
	}

	on(event: string, listener: (...args: any[]) => void): void {
		// Mock implementation
	}

	emit(event: string, ...args: any[]): boolean {
		// Mock implementation
		return true;
	}
}
