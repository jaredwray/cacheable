// source: https://github.com/chakra-ui/chakra-ui/blob/main/packages/utils/src/run-if-fn.ts
type Func<P, T> = (...args: P[]) => T

export function runIfFn<T, P>(valueOrFn: T | Func<P, T>, ...args: P[]): T {
  return typeof valueOrFn === 'function' ? (valueOrFn as Func<P, T>)(...args) : valueOrFn
}
