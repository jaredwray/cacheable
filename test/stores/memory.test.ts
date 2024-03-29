import { describe, it, beforeEach, expect } from 'vitest';
import { faker } from '@faker-js/faker';

import { caching, MemoryCache, MemoryStore, memoryStore } from '../../src';
import { sleep } from '../utils';

describe('memory store', () => {
  describe('instantiating', () => {
    it('lets us pass in no args', () => {
      memoryStore();
    });
  });

  describe('ttl', function () {
    let store: MemoryStore;

    beforeEach(() => {
      store = memoryStore();
    });

    it('if options arg is a number in set()', async () => {
      await store.set('foo', 'bar', 60);
      await sleep(20);
      await expect(store.get('foo')).resolves.toEqual('bar');
    });

    it('when ttl arg is passed 0', async () => {
      const store = memoryStore({ ttl: 1 });
      await store.set('foo', 'bar', 0);
      await sleep(20);
      await expect(store.get('foo')).resolves.toEqual('bar');
    });

    it('cache record should be expired', async () => {
      await store.set('foo', 'bar', 1);
      await sleep(20);
      await expect(store.get('foo')).resolves.toBeUndefined();
    });
  });

  describe('sizeCalculation', function () {
    let store: MemoryStore;

    beforeEach(() => {
      store = memoryStore({
        ttl: 0,
        maxSize: 10,
        sizeCalculation: (v, k) => JSON.stringify(v).length + k.length,
      });
    });

    it('calculatedSize and sizeCalcuation must be the same', async function () {
      await store.set('foo', 'bar');

      expect(store.calculatedSize).toEqual(
        JSON.stringify('bar').length + 'foo'.length,
      );
    });

    it('should cache new value and drop the old one(s) if maxSize is reached', async function () {
      const key = 'foo';
      const value = 'bar';
      await store.set(key, value);

      const cache = await store.get(key);
      expect(cache).toEqual(value);

      const newKey = 'foo2';
      const newValue = 'bar2';

      await store.set(newKey, newValue);

      const first = await store.get(key);
      const second = await store.get(newKey);

      expect(first).toBeUndefined();
      expect(second).toEqual(newValue);
    });

    it('should not cache something greater than maxSize', async function () {
      const key = 'foo';
      const value = 'bar'.repeat(5);
      await store.set(key, value);

      const cache = await store.get(key);
      expect(cache).toBeUndefined();
    });

    it('should throw if invalid sizeCalculation function is passed', () => {
      expect(() =>
        memoryStore({
          // @ts-expect-error testing if this actually throws
          sizeCalculation: () => {
            return 'invalid-type';
          },
        }),
      ).toThrow();
    });
  });

  describe('keyCount', function () {
    let memoryCache: MemoryStore;

    /**
     * Note, stale keys are included in keyCount before those keys are attempted to be accessed", function(done) {
     */
    it('return total length of keys in cache', async () => {
      memoryCache = memoryStore({ ttl: 10 });
      await memoryCache.set('foo', 'bar');
      await memoryCache.set('bar', 'foo', 100);
      expect(memoryCache.size).toEqual(2);
      await sleep(20);
      await expect(memoryCache.get('foo')).resolves.toBeUndefined();
      expect(memoryCache.size).toEqual(1);
    });
  });

  describe('when used with wrap() function', () => {
    let cache: MemoryCache;
    const ttl = 0;

    describe('when cache misses', () => {
      let key: string;
      beforeEach(() => {
        key = faker.string.sample();
      });

      function getCachedObject() {
        return cache.wrap(
          key,
          async () => ({ foo: 'bar', arr: [1, 2, 3] }),
          10 * 1000,
        );
      }

      function getCachedString() {
        return cache.wrap(key, async () => 'bar');
      }

      function getCachedArray() {
        return cache.wrap(key, async () => [1, 2, 3]);
      }

      function getCachedNumber() {
        return cache.wrap(key, async () => 34);
      }

      function getCachedFunction() {
        return cache.wrap(key, async () => () => 'foo');
      }

      class Thing {
        f() {
          return 'foo';
        }
      }

      function getCachedObjectWithPrototype() {
        return cache.wrap(key, async () => new Thing());
      }

      function assertCachedObjectWithPrototype(result: typeof Thing.prototype) {
        expect(typeof result).toEqual('object');
        const prototype = Object.getPrototypeOf(result);
        expect(
          typeof prototype.f,
          'prototype does not have function f',
        ).toEqual('function');

        expect(
          result.f(),
          'prototype function f does not return expected value',
        ).toEqual('foo');
      }

      // By default, memory store clones values before setting in the set method.
      describe('when shouldCloneBeforeSet option is not passed in', () => {
        beforeEach(async () => {
          cache = await caching('memory', {
            ttl: ttl,
          });
        });

        it('does not allow mutation of objects', async () => {
          const result = await getCachedObject();
          result.foo = 'buzz';
          await expect(getCachedObject()).resolves.toStrictEqual({
            foo: 'bar',
            arr: [1, 2, 3],
          });
        });

        it('does not allow mutation of arrays', async () => {
          let _result = await getCachedArray();
          _result = [4, 5, 6];

          await expect(getCachedArray()).resolves.toStrictEqual([1, 2, 3]);
        });

        it('does not allow mutation of strings', async () => {
          let _result = await getCachedString();
          _result = 'buzz';
          await expect(getCachedString()).resolves.toEqual('bar');
        });

        it('does not allow mutation of numbers', async () => {
          let _result = await getCachedNumber();
          _result = 12;

          await expect(getCachedNumber()).resolves.toEqual(34);
        });

        it('preserves functions', async () => {
          expect(typeof (await getCachedFunction())).toEqual('function');
          expect(typeof (await getCachedFunction())).toEqual('function');
        });

        it('preserves object prototype', async () => {
          assertCachedObjectWithPrototype(await getCachedObjectWithPrototype());
          assertCachedObjectWithPrototype(await getCachedObjectWithPrototype());
        });
      });

      describe('when shouldCloneBeforeSet=false option is passed in', () => {
        beforeEach(async () => {
          cache = await caching('memory', {
            ttl: ttl,
            shouldCloneBeforeSet: false,
          });
        });

        it('does allow mutation of objects', async () => {
          const result = await getCachedObject();
          result.foo = 'buzz';
          await expect(getCachedObject()).resolves.toStrictEqual({
            foo: 'buzz',
            arr: [1, 2, 3],
          });
        });
      });

      it('does allow mutation of arrays', async () => {
        const result = await getCachedArray();
        result[0] = 9;

        await expect(getCachedArray()).resolves.toStrictEqual([9, 2, 3]);
      });

      it('does not allow mutation of strings', async () => {
        let _result = await getCachedString();
        _result = 'buzz';
        await expect(getCachedString()).resolves.toEqual('bar');
      });

      it('does not allow mutation of numbers', async () => {
        let _result = await getCachedNumber();
        _result = 12;

        await expect(getCachedNumber()).resolves.toEqual(34);
      });

      it('preserves functions', async () => {
        expect(typeof (await getCachedFunction())).toEqual('function');
        expect(typeof (await getCachedFunction())).toEqual('function');
      });

      it('preserves object prototype', async () => {
        assertCachedObjectWithPrototype(await getCachedObjectWithPrototype());
        assertCachedObjectWithPrototype(await getCachedObjectWithPrototype());
      });
      describe('mget() and mset()', function () {
        let value: string;
        let key2: string;
        let value2: string;
        const defaultTtl = 100;

        beforeEach(async () => {
          key = faker.string.sample(20);
          value = faker.string.sample();
          key2 = faker.string.sample(20);
          value2 = faker.string.sample();

          cache = await caching('memory', {
            shouldCloneBeforeSet: false,
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
    });
  });

  describe('dump()', function () {
    let memoryCache: MemoryStore;
    let key1: string;
    let value1: string;
    let key2: string;
    let value2: string;

    beforeEach(function () {
      key1 = faker.string.sample(20);
      value1 = faker.string.sample();
      key2 = faker.string.sample(20);
      value2 = faker.string.sample();
    });

    it('lets us dump data', () => {
      memoryCache = memoryStore();
      memoryCache.set(key1, value1);
      memoryCache.set(key2, value2);

      const data = memoryCache.dump();
      expect(data[0][0]).toEqual(key1);
      expect(data[0][1].value).toEqual(value1);
      expect(data[1][0]).toEqual(key2);
      expect(data[1][1].value).toEqual(value2);
    });
  });

  describe('load()', function () {
    let memoryCache: MemoryStore;
    let key1: string;
    let value1: string;
    let key2: string;
    let value2: string;
    let data: Parameters<typeof memoryCache.load>[number];

    beforeEach(function () {
      key1 = faker.string.sample(20);
      value1 = faker.string.sample();
      key2 = faker.string.sample(20);
      value2 = faker.string.sample();
      data = [
        [key1, { value: value1 }],
        [key2, { value: value2 }],
      ];
    });

    it('lets us load data', async () => {
      memoryCache = memoryStore();

      memoryCache.load(data);
      await expect(memoryCache.get(key1)).resolves.toEqual(value1);
      await expect(memoryCache.get(key2)).resolves.toEqual(value2);
    });
  });
});
