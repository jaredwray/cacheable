
export type CacheableItem = {
	key: string;
	value: any;
	ttl?: number | string;
};

export type CacheableStoreItem = {
	key: string;
	value: any;
	expires?: number;
};
