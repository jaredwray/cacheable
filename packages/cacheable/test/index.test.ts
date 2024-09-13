import {
	vi, describe, test, expect,
} from 'vitest';
import {Keyv} from 'keyv';
import {Cacheable} from '../src/index.js';

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
		keyv.set = async (key: string, value: unknown) => {
			throw new Error('set error');
		};

		let result = false;
		const cacheable = new Cacheable({store: keyv});
		cacheable.on('error', error => {
			expect(error).toBeDefined();
			result = true;
		});
		await cacheable.set('key', 'value');
		expect(result).toBe(true);
	});
});
