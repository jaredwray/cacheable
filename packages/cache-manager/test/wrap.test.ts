import Keyv from 'keyv'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { faker } from '@faker-js/faker'
import { createCache } from '../src'
import { sleep } from './sleep'

describe('wrap', () => {
  let keyv: Keyv
  let cache: ReturnType<typeof createCache>
  let ttl = 500
  const data = { key: '', value: '' }

  beforeEach(async () => {
    data.key = faker.string.alpha(20)
    data.value = faker.string.sample()
    ttl = faker.number.int({ min: 500, max: 1000 })
    keyv = new Keyv()
    cache = createCache({ stores: [keyv] })
  })

  it('basic', async () => {
    const getValue = vi.fn(() => data.value)
    await cache.wrap(data.key, getValue)
    await cache.wrap(data.key, getValue)
    expect(getValue).toBeCalledTimes(1)
  })

  it('ttl - miliseconds', async () => {
    await cache.wrap(data.key, async () => data.value, ttl)
    await expect(cache.get(data.key)).resolves.toEqual(data.value)
    await sleep(ttl + 100)
    await expect(cache.get(data.key)).resolves.toBeNull()
  })

  it('ttl - function', async () => {
    const getTtlFunc = vi.fn(() => ttl)
    await cache.wrap(data.key, async () => data.value, getTtlFunc)
    await expect(cache.get(data.key)).resolves.toEqual(data.value)
    await sleep(ttl + 100)
    await expect(cache.get(data.key)).resolves.toBeNull()
    expect(getTtlFunc).toHaveBeenCalledTimes(1)
  })

  it('calls fn once to fetch value on cache miss when invoked multiple times', async () => {
    const getValue = vi.fn().mockResolvedValue(data.value)

    // Confirm the cache is empty.
    await expect(cache.get(data.key)).resolves.toBeNull()

    // Simulate several concurrent requests for the same value.
    const arr = Array(10).fill(null)
    const results = await Promise.allSettled(arr.map(() => cache.wrap(data.key, getValue, ttl)))

    // Assert that the function was called exactly once.
    expect(getValue).toHaveBeenCalledTimes(1)

    // Assert that all requests resolved to the same value.
    for (const result of results) {
      expect(result).toMatchObject({
        status: 'fulfilled',
        value: data.value,
      })
    }
  })

  it('should allow dynamic refreshThreshold on wrap function', async () => {
    const config = { ttl: 2000, refreshThreshold: 1000 }

    // 1st call should be cached
    expect(await cache.wrap(data.key, async () => 0, config.ttl, config.refreshThreshold)).toEqual(0)
    await sleep(1001)
    // Background refresh, but stale value returned
    expect(await cache.wrap(data.key, async () => 1, config.ttl, config.refreshThreshold)).toEqual(0)
    // New value in cache
    expect(await cache.wrap(data.key, async () => 2, config.ttl, config.refreshThreshold)).toEqual(1)

    await sleep(1001)
    // No background refresh with the new override params
    expect(await cache.wrap(data.key, async () => 3, undefined, 500)).toEqual(1)
    await sleep(500)
    // Background refresh, but stale value returned
    expect(await cache.wrap(data.key, async () => 4, undefined, 500)).toEqual(1)
    expect(await cache.wrap(data.key, async () => 5, undefined, 500)).toEqual(4)
  })

  it('store get failed', async () => {
    const getValue = vi.fn(() => data.value)
    keyv.get = () => {
      throw new Error('get failed')
    }
    const refreshThreshold = ttl / 2
    await expect(cache.wrap(data.key, getValue, ttl, refreshThreshold)).resolves.toEqual(data.value)
    await expect(cache.wrap(data.key, getValue, ttl, refreshThreshold)).resolves.toEqual(data.value)
    expect(getValue).toBeCalledTimes(2)
  })
})
