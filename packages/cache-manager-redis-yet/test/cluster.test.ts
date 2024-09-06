import { describe, expect, it, beforeEach } from 'vitest';
import { caching } from 'cache-manager';
import { redisClusterStore, RedisCache, NoCacheableError } from '../src';
import { RedisClusterOptions, RedisClusterType } from 'redis';

let redisCache: RedisCache<RedisClusterType>;
let customRedisCache: RedisCache<RedisClusterType>;

// TODO: https://github.com/redis/node-redis/issues/2213
const config: RedisClusterOptions & { ttl: number } = {
  rootNodes: [
    { url: 'redis://localhost:6380' },
  ],
  ttl: 0,
};

beforeEach(async () => {
  
  redisCache = await caching(
    redisClusterStore, config
  );

  await redisCache.reset();
  const conf = {
    ...config,
    isCacheable: (val: unknown) => {
      if (val === undefined) {
        // allow undefined
        return true;
      } else if (val === 'FooBarString') {
        // disallow FooBarString
        return false;
      }
      return redisCache.store.isCacheable(val);
    },
  };
  customRedisCache = await caching(
    redisClusterStore, conf
  );
  await customRedisCache.reset();
});

describe('set', () => {
  it('should store a value without ttl', () =>
    expect(redisCache.set('foo', 'bar')).resolves.toBeUndefined());

  it('should store a value with a specific ttl', () =>
    expect(redisCache.set('foo', 'bar', config.ttl)).resolves.toBeUndefined());

  it('should store a value with a infinite ttl', () =>
    expect(redisCache.set('foo', 'bar', 0)).resolves.toBeUndefined());

  it('should not be able to store a null value (not cacheable)', () =>
    expect(redisCache.set('foo2', null)).rejects.toBeDefined());

  it('should store a value without callback', async () => {
    const value = 'baz';
    await redisCache.set('foo', value);
    await expect(redisCache.get('foo')).resolves.toEqual(value);
  });

  it('should not store an invalid value', () =>
    expect(redisCache.set('foo1', undefined)).rejects.toStrictEqual(
      new NoCacheableError('"undefined" is not a cacheable value'),
    ));

  it('should store an undefined value if permitted by isCacheable', async () => {
    expect(customRedisCache.store.isCacheable(undefined)).toBe(true);
    await customRedisCache.set('foo3', undefined);
  });

  it('should not store a value disallowed by isCacheable', async () => {
    expect(customRedisCache.store.isCacheable('FooBarString')).toBe(false);
    await expect(
      customRedisCache.set('foobar', 'FooBarString'),
    ).rejects.toBeDefined();
  });

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.client.disconnect();
    await expect(redisCache.set('foo', 'bar')).rejects.toBeDefined();
  });
});

describe('mset', () => {
  it('should store a value without ttl', () =>
    redisCache.store.mset([
      ['{foo}', 'bar'],
      ['{foo}2', 'bar2'],
    ]));

  it(
    'should store a value with a specific ttl',
    () =>
      redisCache.store.mset(
        [
          ['{foo}', 'bar'],
          ['{foo}2', 'bar2'],
        ],
        60,
      ),
    100000,
  );

  it('should store a value with a infinite ttl', async () => {
    await redisCache.store.mset([
      ['{foo}', 'bar'],
      ['{foo}2', 'bar2'],
    ]);
    await expect(redisCache.store.ttl('{foo}')).resolves.toEqual(-1);
  });

  it('should not be able to store a null value (not cacheable)', () =>
    expect(redisCache.store.mset([['foo2', null]])).rejects.toBeDefined());

  it('should store a value without callback', async () => {
    await redisCache.store.mset([
      ['{foo}', 'baz'],
      ['{foo}2', 'baz2'],
    ]);
    await expect(redisCache.store.mget('{foo}', '{foo}2')).resolves.toStrictEqual([
      'baz',
      'baz2',
    ]);
  });

  it('should not store an invalid value', () =>
    expect(redisCache.store.mset([['foo1', undefined]])).rejects.toBeDefined());

  it('should store an undefined value if permitted by isCacheable', async () => {
    expect(customRedisCache.store.isCacheable(undefined)).toBe(true);
    await customRedisCache.store.mset([
      ['{foo}3', undefined],
      ['{foo}4', undefined],
    ]);
    await expect(
      customRedisCache.store.mget('{foo}3', '{foo}4'),
    ).resolves.toStrictEqual(['undefined', 'undefined']);
  });

  it('should not store a value disallowed by isCacheable', async () => {
    expect(customRedisCache.store.isCacheable('FooBarString')).toBe(false);
    await expect(
      customRedisCache.store.mset([['foobar', 'FooBarString']]),
    ).rejects.toBeDefined();
  });

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.client.disconnect();
    await expect(redisCache.store.mset([['foo', 'bar']])).rejects.toBeDefined();
  });
});

describe('mget', () => {
  it('should retrieve a value for a given key', async () => {
    const value = 'bar';
    const value2 = 'bar2';
    await redisCache.store.mset([
      ['{foo}', value],
      ['{foo}2', value2],
    ]);
    await expect(redisCache.store.mget('{foo}', '{foo}2')).resolves.toStrictEqual([
      value,
      value2,
    ]);
  });
  it('should return null when the key is invalid', () =>
    expect(
      redisCache.store.mget('invalid{Key}', 'otherInvalid{Key}'),
    ).resolves.toStrictEqual([undefined, undefined]));

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.client.disconnect();
    await expect(redisCache.store.mget('foo')).rejects.toBeDefined();
  });
});

describe('del', () => {
  it('should delete a value for a given key', async () => {
    await redisCache.set('foo', 'bar');
    await expect(redisCache.del('foo')).resolves.toBeUndefined();
  });

  it('should delete a unlimited number of keys', async () => {
    await redisCache.store.mset([
      ['{foo}', 'bar'],
      ['{foo}2', 'bar2'],
    ]);
    await expect(
      redisCache.store.mdel('{foo}', '{foo}2'),
    ).resolves.toBeUndefined();
  });

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.client.disconnect();
    await expect(redisCache.del('foo')).rejects.toBeDefined();
  });

  it('should delete when key prefix is set', async () => {
		const keyPrefix = "prefix";
    const key = "foo77";
    await redisCache.set(key, "bar");
    const customConfig = {
      ...config, 
      keyPrefix: keyPrefix,
    };
    const redisCachePrefix = await caching(
      redisClusterStore, customConfig
    );
    await redisCachePrefix.set(key, "bar");
    await expect(redisCache.get(`${keyPrefix}:${key}`)).resolves.toEqual("bar");
    await redisCachePrefix.del(key);
    await expect(redisCachePrefix.get(key)).resolves.toBeUndefined();
    expect(redisCache.get(key)).resolves.toEqual("bar");

    await redisCache.store.mset([
			["{foo}", "bar"],
			["{foo}2", "bar2"],
		]);
		await redisCachePrefix.store.mset([
			["{foo}", "bar"],
			["{foo}2", "bar2"],
		]);
		await redisCachePrefix.store.mdel("{foo}", "{foo}2");
		await expect(redisCachePrefix.store.mget("{foo}", "{foo}2")).resolves.toStrictEqual([undefined, undefined]);
		await expect(redisCache.store.mget("{foo}", "{foo}2")).resolves.toStrictEqual([
			"bar",
			"bar2",
		]);
	});
});

describe('reset', () => {
  it('should flush underlying db', () => redisCache.reset());

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.client.disconnect();
    await expect(redisCache.reset()).rejects.toBeDefined();
  });
});

describe('ttl', () => {
  it('should retrieve ttl for a given key', async () => {
    const ttl = 100;
    await redisCache.set('foo', 'bar', ttl);
    await expect(redisCache.store.ttl('foo')).resolves.toBeGreaterThanOrEqual(
			ttl - 10,
		);

    await redisCache.set('foo', 'bar', 0);
    await expect(redisCache.store.ttl('foo')).resolves.toEqual(-1);
  });

  it('should retrieve ttl for an invalid key', () =>
    expect(redisCache.store.ttl('invalidKey')).resolves.toEqual(-2));

  it('should retrieve ttl when key prefix is set', async () => {
		const ttl = 1000;
    const keyPrefix = "prefix";
    const key = "foo77";
    const customConfig = {
      ...config, 
      keyPrefix: keyPrefix,
    };
    const redisCachePrefix = await caching(
      redisClusterStore, customConfig
    );
    await redisCachePrefix.set(key, "bar", ttl);
    await expect(
      redisCachePrefix.store.ttl(key)
    ).resolves.toBeGreaterThanOrEqual(ttl - 10);
    await expect(redisCache.get(key)).resolves.toBeUndefined();
    expect(redisCache.store.ttl(key)).resolves.toEqual(-2);
    const key2 = "foo88";
    await redisCache.set(key2, "bar", 0);
    await expect(redisCache.store.ttl(key2)).resolves.toEqual(-1);
	});

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.client.disconnect();
    await expect(redisCache.store.ttl('foo')).rejects.toBeDefined();
  });
});

describe('keys', () => {
  it('should return an array of keys for the given pattern', async () => {
    await redisCache.set('foo', 'bar');
    await expect(redisCache.store.keys('f*')).resolves.toStrictEqual(['foo']);
  });

  it('should return an array of all keys if called without a pattern', async () => {
    await redisCache.store.mset([
      ['{foo}', 'bar'],
      ['{foo}2', 'bar2'],
      ['{foo}3', 'bar3'],
    ]);
    await expect(
      redisCache.store
        .keys('{f*')
        .then((x) => x.sort((a, b) => a.localeCompare(b))),
    ).resolves.toStrictEqual(['{foo}', '{foo}2', '{foo}3']);
  });

  it('should return an array of keys without pattern', async () => {
    await redisCache.reset();
    await redisCache.set('foo', 'bar');
    await expect(redisCache.store.keys()).resolves.toStrictEqual(['foo']);
  });

  it('should return an error if there is an error acquiring a connection', async () => {
    await redisCache.store.client.disconnect();
    await expect(redisCache.store.keys()).rejects.toBeDefined();
  });
});

describe('isCacheable', () => {
  it('should return true when the value is not undefined', () => {
    expect(redisCache.store.isCacheable(0)).toBeTruthy();
    expect(redisCache.store.isCacheable(100)).toBeTruthy();
    expect(redisCache.store.isCacheable('')).toBeTruthy();
    expect(redisCache.store.isCacheable('test')).toBeTruthy();
  });

  it('should return false when the value is undefined', () => {
    expect(redisCache.store.isCacheable(undefined)).toBeFalsy();
  });

  it('should return false when the value is null', () => {
    expect(redisCache.store.isCacheable(null)).toBeFalsy();
  });
});

describe('redis error event', () => {
  it('should return an error when the redis server is unavailable', async () => {
    await new Promise<void>((resolve) => {
      redisCache.store.client.on('error', (err) => {
        expect(err).not.toEqual(null);
        resolve();
      });

      redisCache.store.client.emit('error', 'Something unexpected');
    });
  });
});

describe('wrap function', () => {
  // Simulate retrieving a user from a database
  const getUser = (id: number) => Promise.resolve({ id });

  it('should work', async () => {
    const id = 123;

    await redisCache.wrap('wrap-promise', () => getUser(id));

    // Second call to wrap should retrieve from cache
    await expect(
      redisCache.wrap('wrap-promise', () => getUser(id + 1)),
    ).resolves.toStrictEqual({ id });
  });
});
