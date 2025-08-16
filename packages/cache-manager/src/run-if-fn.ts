// Source: https://github.com/chakra-ui/chakra-ui/blob/main/packages/utils/src/run-if-fn.ts
type Function_<P, T> = (...arguments_: P[]) => T;

export function runIfFn<T, P>(
	valueOrFunction: T | Function_<P, T>,
	...arguments_: P[]
): T {
	return typeof valueOrFunction === "function"
		? (valueOrFunction as Function_<P, T>)(...arguments_)
		: valueOrFunction;
}
