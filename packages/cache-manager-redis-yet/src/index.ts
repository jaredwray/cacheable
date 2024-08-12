import {
  createClient,
  createCluster,
  RedisClientOptions,
  RedisClientType,
  RedisClusterOptions,
  RedisClusterType,
} from 'redis';
import '@redis/client';
import '@redis/bloom';
import '@redis/graph';
import '@redis/json';
import '@redis/search';
import '@redis/time-series';

import type { Cache, Store, Config } from 'cache-manager';

type Clients = RedisClientType | RedisClusterType;

export type RedisCache<T extends Clients = RedisClientType> = Cache<
  RedisStore<T>
>;

type Name<T extends Clients> = T extends RedisClientType
  ? 'redis'
  : T extends RedisClusterType
    ? 'redis-cluster'
    : never;

export interface RedisStore<T extends Clients = RedisClientType> extends Store {
  name: Name<T>;
  isCacheable: (value: unknown) => boolean;
  get client(): T;
}

export type CustomOptions = {
  keyPrefix?: string;
}

export class NoCacheableError implements Error {
  name = 'NoCacheableError';
  constructor(public message: string) {}
}

export const avoidNoCacheable = async <T>(p: Promise<T>) => {
  try {
    return await p;
  } catch (e) {
    if (!(e instanceof NoCacheableError)) throw e;
  }
};

const getVal = (value: unknown) => JSON.stringify(value) || '"undefined"';

const getFullKey = (originalKey: string, keyPrefix?: string) => `${keyPrefix? `${keyPrefix}:` : ''}${originalKey}`;

function builder<T extends Clients>(
  redisCache: T,
  name: Name<T>,
  reset: () => Promise<void>,
  keys: (pattern: string) => Promise<string[]>,
  options?: Config & CustomOptions,
) {
  const isCacheable =
    options?.isCacheable || ((value) => value !== undefined && value !== null);

  return {
    async get<T>(key: string) {
      const val = await redisCache.get(getFullKey(key, options?.keyPrefix));
      if (val === undefined || val === null) return undefined;
      else return JSON.parse(val) as T;
    },
    async set(key, value, ttl) {
      
      if (!isCacheable(value))
        throw new NoCacheableError(`"${value}" is not a cacheable value`);
      
        const t = ttl === undefined ? options?.ttl : ttl;
        
      if (t !== undefined && t !== 0)
        await redisCache.set(getFullKey(key, options?.keyPrefix), getVal(value), { PX: t });
      else await redisCache.set(getFullKey(key, options?.keyPrefix), getVal(value));
    },
    async mset(args, ttl) {
      const t = ttl === undefined ? options?.ttl : ttl;
      if (t !== undefined && t !== 0) {
        const multi = redisCache.multi();
        for (const [key, value] of args) {
          if (!isCacheable(value))
            throw new NoCacheableError(
              `"${getVal(value)}" is not a cacheable value`,
            );
          
          multi.set(getFullKey(key, options?.keyPrefix), getVal(value), { PX: t });
        }
        await multi.exec();
      } else
        await redisCache.mSet(
          args.map(([key, value]) => {
            if (!isCacheable(value))
              throw new Error(`"${getVal(value)}" is not a cacheable value`);
            return [key, getVal(value)] as [string, string];
          }),
        );
    },
    mget: (...args) =>
      redisCache
        .mGet(args)
        .then((x) =>
          x.map((x) =>
            x === null || x === undefined
              ? undefined
              : (JSON.parse(x) as unknown),
          ),
        ),
    async mdel(...args) {
      let keys = args.map((key) => getFullKey(key, options?.keyPrefix));
      await redisCache.del(args);
    },
    async del(key) {
      await redisCache.del(getFullKey(key, options?.keyPrefix));
    },
    ttl: async (key) => redisCache.pTTL(key),
    keys: (pattern = '*') => keys(pattern),
    reset,
    isCacheable,
    name,
    get client() {
      return redisCache;
    },
  } as RedisStore<T>;
}


// TODO: past instance as option
export async function redisStore(options?: RedisClientOptions & Config & CustomOptions) {
  const redisCache = createClient(options);
  try {
    await redisCache.connect();
  } catch (e) {
    console.error("Redis Connection Error: ", e);
    throw e;
  }

  return redisInsStore(redisCache as RedisClientType, options);
}

/**
 * redisCache should be connected
 */
export function redisInsStore(redisCache: RedisClientType, options?: Config & CustomOptions) {
  const reset = async () => {
    await redisCache.flushDb();
  };
  const keys = (pattern: string) => redisCache.keys(pattern);

  return builder(redisCache, 'redis', reset, keys, options);
}

// TODO: coverage
export async function redisClusterStore(options: RedisClusterOptions & Config) {
  const redisCache = createCluster(options);
  try {
    await redisCache.connect();
  } catch (e) {
    console.error("Redis Connection Error: ", e);
    throw e;
  }
  return redisClusterInsStore(redisCache, options);
}

// TODO: coverage
/**
 * redisCache should be connected
 */
export function redisClusterInsStore(
  redisCache: RedisClusterType,
  options: RedisClusterOptions & Config,
) {
  const reset = async () => {
    await Promise.all(
      redisCache.getMasters().map(async (node) => {
        if (node.client) {
          const client = await node.client;
          await client.flushDb();
        }
      }),
    );
  };

  const keys = async (pattern: string) =>
    (
      await Promise.all(
        redisCache.getMasters().map(async (node) => {
          if (node.client) {
            const client = await node.client;
            return await client.keys(pattern);
          }
          return [];
        }),
      )
    ).flat();

  return builder(redisCache, 'redis-cluster', reset, keys, options);
}
