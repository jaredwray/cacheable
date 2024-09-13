import {
	vi, describe, test, expect,
} from 'vitest';
import {Keyv} from 'keyv';
import {Cacheable, CacheableHooks} from '../src/index.js';

// eslint-disable-next-line no-promise-executor-return
const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('cacheable options and properties', async () => {
	test('should be able to instantiate', async () => {
		const cacheable = new Cacheable();
		expect(cacheable).toBeDefined();
	});
	test('should set store on options', async () => {
		const store = new Keyv();
		const cacheable = new Cacheable({store});
		expect(cacheable.stores[0]).toEqual(store);
	});
	test('should set multiple stores on options', async () => {
		const stores = new Array<Keyv>();
		stores.push(new Keyv(), new Keyv());
		const cacheable = new Cacheable({stores});
		expect(cacheable.stores.length).toEqual(2);
	});

	test('when you pass in store and stores it concats them', async () => {
		const store = new Keyv();
		const stores = new Array<Keyv>();
		stores.push(new Keyv(), new Keyv());
		const cacheable = new Cacheable({store, stores});
		expect(cacheable.stores.length).toEqual(3);
	});

	test('you can change stores via the property', async () => {
		const store = new Keyv();
		const stores = new Array<Keyv>();
		stores.push(new Keyv(), new Keyv());
		const cacheable = new Cacheable({store, stores});
		expect(cacheable.stores.length).toEqual(3);
		cacheable.stores.pop();
		expect(cacheable.stores.length).toEqual(2);
	});

	test('when setting the store property to an empty array it defaults to a new Keyv', async () => {
		const cacheable = new Cacheable();
		expect(cacheable.stores.length).toEqual(1);
		cacheable.stores.pop();
		expect(cacheable.stores.length).toEqual(1);
	});

	test('should enable stats on options', async () => {
		const cacheable = new Cacheable({enableStats: true});
		expect(cacheable.enableStats).toEqual(true);
	});

	test('should enable stats via property', async () => {
		const cacheable = new Cacheable({enableStats: false});
		expect(cacheable.enableStats).toEqual(false);
		cacheable.enableStats = true;
		expect(cacheable.enableStats).toEqual(true);
	});
});

describe('cacheable set method', async () => {
	test('should set a value', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		const result = await cacheable.get('key');
		expect(result).toEqual('value');
	});
	test('should throw on set', async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, 'set').mockImplementation(async () => {
			throw new Error('get error');
		});

		let result = false;
		const cacheable = new Cacheable({store: keyv});
		cacheable.on('error', error => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.set('key', 'value');
		expect(result).toBe(true);
	});
	test('should set a value with ttl', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value', 10);
		await sleep(20);
		const result = await cacheable.get('key');
		expect(result).toBeUndefined();
	});
	test('should handle BEFORE_SET and AFTER_SET hooks', async () => {
		const cacheable = new Cacheable();
		let beforeSet = false;
		let afterSet = false;
		cacheable.onHook(CacheableHooks.BEFORE_SET, async item => {
			beforeSet = true;
			item.value = 'new value';
		});
		cacheable.onHook(CacheableHooks.AFTER_SET, async item => {
			afterSet = true;
			expect(item.value).toEqual('new value');
		});
		await cacheable.set('key', 'value');
		expect(beforeSet).toBe(true);
		expect(afterSet).toBe(true);
	});
});

describe('cacheable get method', async () => {
	test('should get a value', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		const result = await cacheable.get('key');
		expect(result).toEqual('value');
	});
	test('should throw on get', async () => {
		const keyv = new Keyv();
		vi.spyOn(keyv, 'get').mockImplementation(async () => {
			throw new Error('get error');
		});

		let result = false;
		const cacheable = new Cacheable({store: keyv});
		cacheable.on('error', error => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.get('key');
		expect(result).toBe(true);
	});
	test('should handle BEFORE_GET and AFTER_GET hooks', async () => {
		const cacheable = new Cacheable();
		let beforeGet = false;
		let afterGet = false;
		cacheable.onHook(CacheableHooks.BEFORE_GET, async key => {
			beforeGet = true;
			expect(key).toEqual('key');
		});
		cacheable.onHook(CacheableHooks.AFTER_GET, async item => {
			afterGet = true;
			expect(item.key).toEqual('key');
			expect(item.result).toEqual('value');
		});
		await cacheable.set('key', 'value');
		await cacheable.get('key');
		expect(beforeGet).toBe(true);
		expect(afterGet).toBe(true);
	});
});

describe('cacheable has method', async () => {
	test('should check if key exists and return false', async () => {
		const cacheable = new Cacheable();
		const result = await cacheable.has('key');
		expect(result).toBe(false);
	});
	test('should check if key exists and return tru', async () => {
		const cacheable = new Cacheable();
		await cacheable.set('key', 'value');
		const result = await cacheable.has('key');
		expect(result).toBe(true);
	});
});
