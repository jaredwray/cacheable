import Keyv from 'keyv'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { faker } from '@faker-js/faker'
import { createCache } from '../src'
import { sleep } from './sleep'

describe('events', () => {
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

  it('event: set', async () => {
    const listener = vi.fn(() => {})
    cache.on('set', listener)

    await cache.set(data.key, data.value)
    expect(listener).toBeCalledWith(data)

    const error = new Error('set failed')
    keyv.set = () => {
      throw error
    }
    await expect(cache.set(data.key, data.value)).rejects.toThrowError(error)
    expect(listener).toBeCalledWith({ key: data.key, value: data.value, error })
  })

  it('event: del', async () => {
    const listener = vi.fn(() => {})
    cache.on('del', listener)

    await cache.set(data.key, data.value)
    await cache.del(data.key)
    expect(listener).toBeCalledWith({ key: data.key })

    const error = new Error('del failed')
    keyv.delete = () => {
      throw error
    }
    await expect(cache.del(data.key)).rejects.toThrowError(error)
    expect(listener).toBeCalledWith({ key: data.key, error })
  })

  it('event: clear', async () => {
    const listener = vi.fn(() => {})
    cache.on('clear', listener)

    await cache.set(data.key, data.value)
    await cache.clear()
    expect(listener).toBeCalled()

    const error = new Error('clear failed')
    keyv.clear = () => {
      throw error
    }
    await expect(cache.clear()).rejects.toThrowError(error)
    expect(listener).toBeCalledWith(error)
  })

  it('event: refresh', async () => {
    const getValue = () => data.value
    const listener = vi.fn(() => {})
    cache.on('refresh', listener)

    const refreshThreshold = ttl / 2
    await cache.wrap(data.key, getValue, ttl, refreshThreshold)
    await sleep(ttl - refreshThreshold + 100)
    await cache.wrap(data.key, getValue, ttl, refreshThreshold)
    await vi.waitUntil(() => listener.mock.calls.length > 0)
    expect(listener).toBeCalledWith({ key: data.key, value: data.value })
  })

  it('event: refresh get error', async () => {
    const listener = vi.fn(() => {})
    cache.on('refresh', listener)

    const refreshThreshold = ttl / 2
    await cache.wrap(data.key, () => data.value, ttl, refreshThreshold)

    const error = new Error('get failed')
    await sleep(ttl - refreshThreshold + 100)
    await cache.wrap(
      data.key,
      () => {
        throw error
      },
      ttl,
      refreshThreshold
    )
    await vi.waitUntil(() => listener.mock.calls.length > 0)
    expect(listener).toBeCalledWith({ key: data.key, value: data.value, error })
  })

  it('event: refresh set error', async () => {
    const getValue = () => data.value
    const listener = vi.fn(() => {})
    cache.on('refresh', listener)

    const refreshThreshold = ttl / 2
    await cache.wrap(data.key, getValue, ttl, refreshThreshold)

    const error = new Error('set failed')
    keyv.set = () => {
      throw error
    }

    await sleep(ttl - refreshThreshold + 100)
    await cache.wrap(data.key, getValue, ttl, refreshThreshold)
    await vi.waitUntil(() => listener.mock.calls.length > 0)
    expect(listener).toBeCalledWith({ key: data.key, value: data.value, error })
  })
})
