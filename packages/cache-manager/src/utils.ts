/**
 * If blocking is true, it will await the function before returning.
 * Otherwise, it will fire the execution and return before it ends.
 * Consumer of this function should await the returned promise.
 * @param function_
 * @param blocking
 */
export const conditionalAwait = async (function_: () => Promise<unknown>, blocking: boolean): Promise<void> => {
	if (blocking) {
		await function_();
	} else {
		void function_().then();
	}
};
