import Keyv from 'keyv'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { faker } from '@faker-js/faker'
import { createCache } from '../src'
import { sleep } from './sleep'

describe('multiple stores', () => {
  let keyv1: Keyv
  let keyv2: Keyv
  let cache: ReturnType<typeof createCache>
  let ttl = 500
  const data = { key: '', value: '' }

  beforeEach(async () => {
    data.key = faker.string.alpha(20)
    data.value = faker.string.sample()
    ttl = faker.number.int({ min: 500, max: 1000 })
    keyv1 = new Keyv()
    keyv2 = new Keyv()
    cache = createCache({ stores: [keyv1, keyv2] })
  })

  it('set', async () => {
    await cache.set(data.key, data.value, ttl)
    await expect(keyv1.get(data.key)).resolves.toEqual(data.value)
    await expect(keyv2.get(data.key)).resolves.toEqual(data.value)
    await expect(cache.get(data.key)).resolves.toEqual(data.value)
  })

  it('get - 1 store error', async () => {
    await cache.set(data.key, data.value, ttl)

    keyv1.get = () => {
      throw new Error('store 1 get error')
    }

    await expect(cache.get(data.key)).resolves.toEqual(data.value)
  })

  it('get - 2 stores error', async () => {
    await cache.set(data.key, data.value, ttl)

    const getError = () => {
      throw new Error('store 1 get error')
    }
    keyv1.get = getError
    keyv2.get = getError

    await expect(cache.get(data.key)).resolves.toBeNull()
  })

  it('del', async () => {
    await cache.set(data.key, data.value, ttl)

    await expect(keyv1.get(data.key)).resolves.toEqual(data.value)
    await expect(keyv2.get(data.key)).resolves.toEqual(data.value)

    await cache.del(data.key)

    await expect(keyv1.get(data.key)).resolves.toBeUndefined()
    await expect(keyv2.get(data.key)).resolves.toBeUndefined()
  })

  it('wrap', async () => {
    await cache.wrap(data.key, () => data.value, ttl)

    await expect(keyv1.get(data.key)).resolves.toEqual(data.value)
    await expect(keyv2.get(data.key)).resolves.toEqual(data.value)

    // store 1 get error
    keyv1.get = () => {
      throw new Error('store 1 get error')
    }

    const listener = vi.fn(() => {})
    cache.on('set', listener)

    await expect(cache.wrap(data.key, () => data.value, ttl)).resolves.toEqual(data.value)
    await vi.waitUntil(() => listener.mock.calls.length > 0)
    expect(listener).toBeCalledWith({ key: data.key, value: data.value })
  })

  it('wrap - refresh', async () => {
    const refreshThreshold = ttl / 2
    await cache.wrap(data.key, () => data.value, ttl, refreshThreshold)

    await expect(keyv1.get(data.key)).resolves.toEqual(data.value)
    await expect(keyv2.get(data.key)).resolves.toEqual(data.value)

    // store 1 get error
    const getOk = keyv1.get
    const getError = () => {
      throw new Error('store 1 get error')
    }
    keyv1.get = getError

    await sleep(ttl - refreshThreshold + 100)

    await expect(cache.wrap(data.key, () => 'new', ttl, refreshThreshold)).resolves.toEqual(data.value)

    keyv1.get = getOk
    // store 1 has been updated the latest value
    await expect(keyv1.get(data.key)).resolves.toEqual('new')
    await expect(cache.wrap(data.key, () => 'latest', ttl)).resolves.toEqual('new')
  })
})
