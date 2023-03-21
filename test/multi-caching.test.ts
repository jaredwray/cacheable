import { describe, expect, it, beforeEach } from 'vitest';
import { faker } from '@faker-js/faker';

import { sleep } from './utils';

import {
  Cache,
  caching,
  MemoryCache,
  MultiCache,
  multiCaching,
  Store,
} from '../src';

describe('multiCaching', () => {
  let memoryCache: MemoryCache;
  let memoryCache2: MemoryCache;
  let memoryCache3: MemoryCache;
  let multiCache: MultiCache;
  let ttl: number;
  let defaultTtl: number;
  let key: string;

  beforeEach(async () => {
    ttl = 100;
    defaultTtl = 5000;

    memoryCache = await caching('memory', {
      ttl,
    });
    memoryCache2 = await caching('memory', {
      ttl,
    });
    memoryCache3 = await caching('memory', {
      ttl,
    });

    key = faker.datatype.string(20);
  });

  describe('get(), set(), del(), reset(), mget(), mset()', () => {
    let value: string;

    beforeEach(() => {
      multiCache = multiCaching([memoryCache, memoryCache2, memoryCache3]);
      key = faker.datatype.string(20);
      value = faker.datatype.string();
    });

    describe('set()', () => {
      it('lets us set data in all caches', async () => {
        await multiCache.set(key, value, defaultTtl);
        await expect(memoryCache.get(key)).resolves.toEqual(value);
        await expect(memoryCache2.get(key)).resolves.toEqual(value);
        await expect(memoryCache3.get(key)).resolves.toEqual(value);
      });
    });

    describe('get()', () => {
      it('lets us get data', async () => {
        await multiCache.set(key, value, defaultTtl);
        await expect(multiCache.get(key)).resolves.toEqual(value);
      });
    });

    describe('wrap()', () => {
      it('should get data', async () => {
        await multiCache.wrap(key, async () => value);
        await expect(memoryCache.get(key)).resolves.toEqual(value);
        await expect(memoryCache2.get(key)).resolves.toEqual(value);
        await expect(memoryCache3.get(key)).resolves.toEqual(value);
        await expect(multiCache.wrap(key, async () => 'foo')).resolves.toEqual(
          value,
        );
      });
    });

    describe('del()', () => {
      it('should delete data', async () => {
        await multiCache.set(key, value);
        await multiCache.del(key);
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });
    });

    describe('reset()', () => {
      it('should reset cache', async () => {
        await multiCache.set(key, value);
        await multiCache.reset();
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });
    });

    describe('mset()', () => {
      it('lets us set multiple keys in all caches', async () => {
        const keys = [faker.datatype.string(20), faker.datatype.string(20)];
        const values = [faker.datatype.string(), faker.datatype.string()];
        await multiCache.mset(
          [
            [keys[0], values[0]],
            [keys[1], values[1]],
          ],
          defaultTtl,
        );
        await expect(memoryCache.get(keys[0])).resolves.toEqual(values[0]);
        await expect(memoryCache2.get(keys[0])).resolves.toEqual(values[0]);
        await expect(memoryCache3.get(keys[0])).resolves.toEqual(values[0]);
        await expect(memoryCache.get(keys[1])).resolves.toEqual(values[1]);
        await expect(memoryCache2.get(keys[1])).resolves.toEqual(values[1]);
        await expect(memoryCache3.get(keys[1])).resolves.toEqual(values[1]);
      });
    });

    describe('mget()', () => {
      it('lets us get multiple keys', async () => {
        const keys = [faker.datatype.string(20), faker.datatype.string(20)];
        const values = [faker.datatype.string(), faker.datatype.string()];
        await multiCache.set(keys[0], values[0], defaultTtl);
        await memoryCache3.set(keys[1], values[1], defaultTtl);
        await expect(multiCache.mget(...keys)).resolves.toStrictEqual(values);
      });
    });

    describe('mdel()', () => {
      it('lets us delete multiple keys', async () => {
        const keys = [faker.datatype.string(20), faker.datatype.string(20)];
        const values = [faker.datatype.string(), faker.datatype.string()];
        await multiCache.mset(
          [
            [keys[0], values[0]],
            [keys[1], values[1]],
          ],
          defaultTtl,
        );
        await expect(multiCache.mget(...keys)).resolves.toStrictEqual(values);
        await multiCache.mdel(...keys);
        await expect(multiCache.mget(...keys)).resolves.toStrictEqual([
          undefined,
          undefined,
        ]);
      });
    });

    describe('when cache fails', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const empty = (async () => {}) as never;
      const cache: Cache = {
        get: async () => {
          throw new Error();
        },
        set: empty,
        del: empty,
        reset: empty,
        wrap: empty,
        store: {} as Store,
      };

      const cacheEmpty: Cache = {
        get: empty,
        set: empty,
        del: empty,
        reset: empty,
        wrap: empty,
        store: {} as Store,
      };

      it('should get error', async () => {
        multiCache = multiCaching([cache, memoryCache]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toEqual(value);
      });

      it('should get all error', async () => {
        multiCache = multiCaching([cache]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });

      it('should get empty', async () => {
        multiCache = multiCaching([cacheEmpty, memoryCache]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toEqual(value);
      });

      it('should get all empty', async () => {
        multiCache = multiCaching([cacheEmpty, cacheEmpty]);
        await multiCache.set(key, value);
        await expect(multiCache.get(key)).resolves.toBeUndefined();
      });
    });
  });

  describe('issues', () => {
    it('#253', async () => {
      const cache0 = await caching('memory', { ttl: 500 });
      const cache1 = await caching('memory', { ttl: 1000 });
      const multi = multiCaching([cache0, cache1]);
      const key = 'bar';
      const value = 'foo';

      const fn = async () => value;

      await multi.wrap(key, fn);
      await sleep(600);
      await expect(cache0.get(key)).resolves.toBeUndefined();
      await expect(cache1.get(key)).resolves.toEqual(value);

      await multi.wrap(key, fn);

      await expect(cache0.get(key)).resolves.toEqual(value);
      await expect(cache1.get(key)).resolves.toEqual(value);
    });
  });
});
