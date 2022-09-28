import { describe, it, beforeEach, expect } from 'vitest';
import { faker } from '@faker-js/faker';

import { caching, Cache, MemoryConfig, memoryStore } from '../src';
import { sleep } from './utils';

describe('caching', () => {
  let cache: Cache;
  let key: string;
  const defaultTtl = 100;
  let value: string;

  describe('constructor', () => {
    it('should from store', async () => {
      const store = memoryStore();
      await expect(caching(store)).resolves.toBeDefined();
    });
  });

  describe('get() and set()', () => {
    beforeEach(async () => {
      cache = await caching('memory');
      key = faker.random.alpha(20);
      value = faker.datatype.string();
    });

    it('lets us set and get data in cache', async () => {
      await cache.set(key, value, defaultTtl);
      await sleep(20);
      await expect(cache.get(key)).resolves.toEqual(value);
    });

    it('should error no isCacheable value', () =>
      expect(cache.set(key, undefined)).rejects.toStrictEqual(
        new Error('no cacheable value undefined'),
      ));
    it('should error no isCacheable value', () =>
      expect(cache.store.mset([[key, undefined]])).rejects.toStrictEqual(
        new Error('no cacheable value undefined'),
      ));

    it('lets us set and get data without a callback', async () => {
      cache = await caching(async (arg?: MemoryConfig) => memoryStore(arg));
      await cache.set(key, value, defaultTtl);
      await sleep(20);
      await expect(cache.get(key)).resolves.toEqual(value);
    });

    it('lets us set and get data without options object or callback', async () => {
      cache = await caching(async (arg?: MemoryConfig) => memoryStore(arg));
      await cache.set(key, value);
      await sleep(20);
      await expect(cache.get(key)).resolves.toEqual(value);
    });
  });

  describe('mget() and mset()', function () {
    let key2: string;
    let value2: string;
    const store = 'memory';

    beforeEach(async () => {
      key = faker.datatype.string(20);
      value = faker.datatype.string();
      key2 = faker.datatype.string(20);
      value2 = faker.datatype.string();

      cache = await caching(store, {
        ttl: defaultTtl,
      });
    });

    it('lets us set and get several keys and data in cache', async () => {
      await cache.store.mset(
        [
          [key, value],
          [key2, value2],
        ],
        defaultTtl,
      );
      await sleep(20);
      await expect(cache.store.mget(key, key2)).resolves.toStrictEqual([
        value,
        value2,
      ]);
    });

    it('lets us set and get data without options', async () => {
      await cache.store.mset(
        [
          [key, value],
          [key2, value2],
        ],
        defaultTtl,
      );
      await sleep(20);
      await expect(cache.store.mget(key, key2)).resolves.toStrictEqual([
        value,
        value2,
      ]);
    });
  });

  describe('del()', function () {
    beforeEach(async () => {
      cache = await caching('memory');
      key = faker.datatype.string(20);
      value = faker.datatype.string();
      await cache.set(key, value, defaultTtl);
    });

    it('deletes data from cache', async () => {
      await expect(cache.get(key)).resolves.toEqual(value);
      await cache.del(key);
      await expect(cache.get(key)).resolves.toBeUndefined();
    });

    describe('with multiple keys', function () {
      let key2: string;
      let value2: string;

      beforeEach(async () => {
        cache = await caching('memory');
        key2 = faker.datatype.string(20);
        value2 = faker.datatype.string();
        await cache.store.mset(
          [
            [key, value],
            [key2, value2],
          ],
          defaultTtl,
        );
      });

      it('deletes an an array of keys', async () => {
        await expect(cache.store.mget(key, key2)).resolves.toStrictEqual([
          value,
          value2,
        ]);
        await cache.store.mdel(key, key2);
        await expect(cache.store.mget(key, key2)).resolves.toStrictEqual([
          undefined,
          undefined,
        ]);
      });
    });
  });

  describe('reset()', () => {
    let key2: string;
    let value2: string;

    beforeEach(async () => {
      cache = await caching('memory');
      key = faker.datatype.string(20);
      value = faker.datatype.string();
      await cache.set(key, value);
      key2 = faker.datatype.string(20);
      value2 = faker.datatype.string();
      await cache.set(key2, value2);
    });

    it('clears the cache', async () => {
      await cache.reset();
      await expect(cache.get(key)).resolves.toBeUndefined();
      await expect(cache.get(key2)).resolves.toBeUndefined();
    });
  });

  describe('keys()', () => {
    let keyCount: number;
    let savedKeys: string[];

    beforeEach(async () => {
      keyCount = 10;
      cache = await caching('memory');

      savedKeys = (
        await Promise.all(
          Array.from({ length: keyCount }).map(async (_, i) => {
            const key =
              (i % 3 === 0 ? 'prefix' : '') + faker.datatype.string(20);
            value = faker.datatype.string();
            await cache.set(key, value);
            return key;
          }),
        )
      ).sort((a, b) => a.localeCompare(b));
    });

    it('calls back with all keys in cache', () =>
      expect(
        cache.store.keys().then((x) => x.sort((a, b) => a.localeCompare(b))),
      ).resolves.toStrictEqual(savedKeys));
  });

  describe('issues', () => {
    it('#183', () =>
      expect(cache.wrap('constructor', async () => 0)).resolves.toEqual(0));
  });
});
