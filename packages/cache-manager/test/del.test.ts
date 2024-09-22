import Keyv from 'keyv'
import { beforeEach, describe, expect, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { createCache } from '../src'

describe('del', () => {
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
    await cache.set(data.key, data.value, ttl)
    await expect(cache.get(data.key)).resolves.toEqual(data.value)
    await expect(cache.del(data.key)).resolves.toEqual(true)
    await expect(cache.get(data.key)).resolves.toBeNull()
  })

  it('error', async () => {
    await cache.set(data.key, data.value)
    const error = new Error('delete error')
    keyv.delete = () => {
      throw error
    }
    await expect(cache.del(data.key)).rejects.toThrowError(error)
  })
})
