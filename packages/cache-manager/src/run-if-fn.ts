// Source: https://github.com/chakra-ui/chakra-ui/blob/main/packages/utils/src/run-if-fn.ts
// eslint-disable-next-line @typescript-eslint/naming-convention
type Function_<P, T> = (...arguments_: P[]) => T;

// eslint-disable-next-line unicorn/prevent-abbreviations
export function runIfFn<T, P>(valueOrFunction: T | Function_<P, T>, ...arguments_: P[]): T {
	return typeof valueOrFunction === 'function' ? (valueOrFunction as Function_<P, T>)(...arguments_) : valueOrFunction;
}
