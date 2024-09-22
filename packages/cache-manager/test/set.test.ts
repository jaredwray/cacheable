import Keyv from 'keyv'
import { beforeEach, describe, expect, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { createCache } from '../src'

describe('set', () => {
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
    await expect(cache.set(data.key, data.value)).resolves.toEqual(data.value)
    await expect(cache.set(data.key, data.value, ttl)).resolves.toEqual(data.value)
    await expect(cache.get(data.key)).resolves.toEqual(data.value)
  })

  it('error', async () => {
    const error = new Error('set error')
    keyv.set = () => {
      throw error
    }
    await expect(cache.set(data.key, data.value)).rejects.toThrowError(error)
    await expect(cache.get(data.key)).resolves.toEqual(null)
  })
})
