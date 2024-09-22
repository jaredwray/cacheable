import Keyv from 'keyv'
import { beforeEach, describe, expect, it } from 'vitest'
import { faker } from '@faker-js/faker'
import { createCache } from '../src'
import { sleep } from './sleep'

describe('init', () => {
  let ttl = 1000
  const data = { key: '', value: '' }

  beforeEach(async () => {
    data.key = faker.string.alpha(20)
    data.value = faker.string.sample()
    ttl = faker.number.int({ min: 500, max: 1000 })
  })

  it('basic', async () => {
    const cache = createCache()
    expect(cache).toBeDefined()
  })

  it('default ttl', async () => {
    const cache = createCache({ ttl })
    await cache.set(data.key, data.value)
    await sleep(ttl + 100)
    await expect(cache.get(data.key)).resolves.toEqual(null)
  })

  it('single store', async () => {
    const cache = createCache({
      stores: [new Keyv()],
    })
    expect(cache).toBeDefined()
  })

  it('mutiple stores', async () => {
    const store1 = new Keyv()
    const store2 = new Keyv()
    const cache = createCache({
      stores: [store1, store2],
    })
    expect(cache).toBeDefined()
  })
})
