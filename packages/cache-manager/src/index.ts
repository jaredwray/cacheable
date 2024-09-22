import EventEmitter from 'events'
import Keyv from 'keyv'
import { coalesceAsync } from './coalesce-async'
import { runIfFn } from './run-if-fn'
import { lt } from './lt'

export interface CreateCacheOptions {
  stores?: Keyv[]
  ttl?: number
  refreshThreshold?: number
}

export type Events = {
  set: <T>(data: { key: string; value: T; error?: unknown }) => void
  del: (data: { key: string; error?: unknown }) => void
  clear: (error?: unknown) => void
  refresh: <T>(data: { key: string; value: T; error?: unknown }) => void
}

export const createCache = (options?: CreateCacheOptions) => {
  const eventEmitter = new EventEmitter()
  const stores = options?.stores?.length ? options.stores : [new Keyv()]

  const get = async <T>(key: string) => {
    for (const store of stores) {
      try {
        const data = await store.get(key)
        if (data !== undefined) return data as T
      } catch {
        //
      }
    }

    return null
  }

  const set = async <T>(stores: Keyv[], key: string, value: T, ttl?: number) => {
    try {
      await Promise.all(stores.map(async (store) => store.set(key, value, ttl ?? options?.ttl)))
      eventEmitter.emit('set', { key, value })
      return value
    } catch (error) {
      eventEmitter.emit('set', { key, value, error })
      return Promise.reject(error)
    }
  }

  const del = async (key: string) => {
    try {
      await Promise.all(stores.map(async (store) => store.delete(key)))
      eventEmitter.emit('del', { key })
      return true
    } catch (error) {
      eventEmitter.emit('del', { key, error })
      return Promise.reject(error)
    }
  }

  const clear = async () => {
    try {
      await Promise.all(stores.map(async (store) => store.clear()))
      eventEmitter.emit('clear')
      return true
    } catch (error) {
      eventEmitter.emit('clear', error)
      return Promise.reject(error)
    }
  }

  const wrap = async <T>(
    key: string,
    fnc: () => T | Promise<T>,
    ttl?: number | ((value: T) => number),
    refreshThreshold?: number
  ): Promise<T> => {
    return coalesceAsync(key, async () => {
      let value: T | undefined
      let i = 0
      let remainingTtl: number | undefined

      for (; i < stores.length; i++) {
        try {
          const data = await stores[i].get<T>(key, { raw: true })
          if (data !== undefined) {
            value = data.value
            if (typeof data.expires === 'number') {
              remainingTtl = Math.max(0, data.expires - Date.now())
            }

            break
          }
        } catch {
          //
        }
      }

      if (value === undefined) {
        const result = await fnc()
        await set(stores, key, result, runIfFn(ttl, result) ?? options?.ttl)
        return result
      }

      const ms = runIfFn(ttl, value) ?? options?.ttl
      const shouldRefresh = lt(remainingTtl, refreshThreshold ?? options?.refreshThreshold)

      if (shouldRefresh) {
        coalesceAsync(`+++${key}`, fnc)
          .then(async (result) => {
            try {
              await set(stores.slice(0, i + 1), key, result, ms)
              eventEmitter.emit('refresh', { key, value: result })
            } catch (error) {
              eventEmitter.emit('refresh', { key, value, error })
            }
          })
          .catch((error) => {
            eventEmitter.emit('refresh', { key, value, error })
          })
      }

      if (!shouldRefresh && i > 0) {
        await set(stores.slice(0, i), key, value, ms)
      }

      return value
    })
  }

  const on = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.addListener(event, listener)

  const off = <E extends keyof Events>(event: E, listener: Events[E]) => eventEmitter.removeListener(event, listener)

  return {
    get,
    set: async <T>(key: string, value: T, ttl?: number) => set(stores, key, value, ttl),
    del,
    clear,
    wrap,
    on,
    off,
  }
}
