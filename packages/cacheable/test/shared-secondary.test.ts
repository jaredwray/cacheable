import {
	test, expect,
} from 'vitest';
import {Keyv} from 'keyv';
import {Cacheable} from '../src/index.js';
import {sleep} from './sleep.js';

/*
	Should get a value from the secondary store and respect its ttl when setting the value in the primary store (item specific ttl)
*/
test('should get a value from the secondary store and respect its ttl', async () => {
	const instance1Primary = new Keyv();
	const instance2Primary = new Keyv();

	const sharedSecondary = new Keyv();

	const instance1 = new Cacheable({primary: instance1Primary, secondary: sharedSecondary});
	const instance2 = new Cacheable({primary: instance2Primary, secondary: sharedSecondary});

	// Set the value in the first instance
	await instance1.set('key', 'value', 100);

	await sleep(50);

	// Get the value in the second instance
	const result = await instance2.get('key');
	expect(result).toEqual('value');

	// Wait for the value to expire
	await sleep(150);

	// Get the value in the second instance (it should be expired)
	const result2 = await instance2.get('key');
	expect(result2, 'result should have expired').toBeUndefined();
});

/*
	Should get a value from the secondary store and respect its zero-ttl when setting the value in the primary store (item specific zero-ttl)
*/
test('secondar store as a zero ttl set', async () => {
	const instance1Primary = new Keyv();
	const instance2Primary = new Keyv();

	const sharedSecondary = new Keyv();

	const instance1 = new Cacheable({primary: instance1Primary, secondary: sharedSecondary, ttl: 100});
	const instance2 = new Cacheable({primary: instance2Primary, secondary: sharedSecondary, ttl: 100});

	// Set the value in the first instance
	await instance1.set('key', 'value', 0);

	await sleep(50);

	// Get the value in the second instance
	const result = await instance2.get('key');
	expect(result).toEqual('value');

	// Wait past the time of the default TTL of 500ms
	await sleep(150);

	// Get the value in the second instance (it should be valid)
	const result2 = await instance2.get('key');
	expect(result2).toEqual('value');
});

/*
	Should get a value from the secondary store and respect its ttl when setting the value in the primary store (default ttl when setting)
*/
test('default ttl when setting', async () => {
	const instance1Primary = new Keyv();
	const instance2Primary = new Keyv();

	const sharedSecondary = new Keyv();

	const instance1 = new Cacheable({primary: instance1Primary, secondary: sharedSecondary, ttl: 100});
	const instance2 = new Cacheable({primary: instance2Primary, secondary: sharedSecondary});

	// Set the value in the first instance
	await instance1.set('key', 'value');

	await sleep(50);

	// Get the value in the second instance
	const result = await instance2.get('key');
	expect(result).toEqual('value');

	// Wait for the value to expire
	await sleep(150);

	// Get the value in the second instance (it should be expired)
	const result2 = await instance2.get('key');
	expect(result2, 'result should have expired').toBeUndefined();
});

/*
	Should get a value from the secondary store and respect its zero-ttl when setting the value in the primary store (default zero-ttl when setting)
*/
test('should get a value from the secondary store and respect its zero-ttl', async () => {
	const instance1Primary = new Keyv();
	const instance2Primary = new Keyv();

	const sharedSecondary = new Keyv();

	const instance1 = new Cacheable({primary: instance1Primary, secondary: sharedSecondary, ttl: 0});
	const instance2 = new Cacheable({primary: instance2Primary, secondary: sharedSecondary, ttl: 200});

	// Set the value in the first instance
	await instance1.set('key', 'value');

	await sleep(100);

	// Get the value in the second instance
	const result = await instance2.get('key');
	expect(result).toEqual('value');

	// Wait past instance2's default TTL of 500ms
	await sleep(250);

	// Get the value in the second instance (it should be valid)
	const result2 = await instance2.get('key');
	expect(result2).toEqual('value');
});

/*
	Should get a value from the secondary store and respect its ttl when setting the value in the primary store (default ttl when setting in the first instance, despite alternative ttl when getting in the second instance)
*/
test('default ttl when setting in the first instance, despite alternative ttl', async () => {
	const instance1Primary = new Keyv();
	const instance2Primary = new Keyv();

	const sharedSecondary = new Keyv();

	const instance1 = new Cacheable({primary: instance1Primary, secondary: sharedSecondary, ttl: 100});
	const instance2 = new Cacheable({primary: instance2Primary, secondary: sharedSecondary, ttl: 200});

	// Set the value in the first instance
	await instance1.set('key', 'value');

	await sleep(50);

	// Get the value in the second instance
	const result = await instance2.get('key');
	expect(result).toEqual('value');

	// Wait for the value to expire
	await sleep(200);

	// Get the value in the second instance (it should be expired)
	const result2 = await instance2.get('key');
	expect(result2, 'result should have expired').toBeUndefined();
});

/*
	Should get a value from the secondary store and respect its zero-ttl when setting the value in the primary store
	(default zero-ttl when setting in the first instance, despite alternative ttl when getting in the second instance)
*/
test('default zero-ttl when setting in the first instance, despite alternative ttl', async () => {
	const instance1Primary = new Keyv();
	const instance2Primary = new Keyv();

	const sharedSecondary = new Keyv();

	const instance1 = new Cacheable({primary: instance1Primary, secondary: sharedSecondary, ttl: 0});
	const instance2 = new Cacheable({primary: instance2Primary, secondary: sharedSecondary, ttl: 200});

	// Set the value in the first instance
	await instance1.set('key', 'value');

	await sleep(100);

	// Get the value in the second instance
	const result = await instance2.get('key');
	expect(result).toEqual('value');

	// Wait past instance2's default TTL of 500ms
	await sleep(250);

	// Get the value in the second instance (it should be valid)
	const result2 = await instance2.get('key');
	expect(result2).toEqual('value');
});

/*
	Should not return a value from the secondary store or set it in the primary store when the value is expired in the secondary store
*/
test('should not set in primary store if expired', async () => {
	const instance1Primary = new Keyv();
	const instance2Primary = new Keyv();

	// A custom Keyv class designed return an expired value
	class CustomKeyv<T> extends Keyv<T> {
		async get(key: string | string[], options?: {raw?: boolean}): Promise<any> {
			const value = await super.get(key as unknown as string, options?.raw ? {raw: true} : undefined);

			await sleep(100);

			return value;
		}
	}
	const sharedSecondary = new CustomKeyv();

	const instance1 = new Cacheable({primary: instance1Primary, secondary: sharedSecondary});
	const instance2 = new Cacheable({primary: instance2Primary, secondary: sharedSecondary});

	// Set the value in the secondary store
	await instance1.set('key', 'value', 50);

	await sleep(100);

	// Get the value in the second instance
	const result = await instance2.get('key');
	expect(result, 'result should have expired').toBeUndefined();

	// Get the value in the primary store
	const result2 = await instance2Primary.get('key') as unknown;
	expect(result2, 'result should not be placed in the primary store').toBeUndefined();
});
