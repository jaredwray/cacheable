type PromiseCallback<T = any, E = Error> = {
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason: E) => void;
};

const callbacks = new Map<string, PromiseCallback[]>();

function hasKey(key: string): boolean {
	return callbacks.has(key);
}

function addKey(key: string): void {
	callbacks.set(key, []);
}

function removeKey(key: string): void {
	callbacks.delete(key);
}

function addCallbackToKey<T>(key: string, callback: PromiseCallback<T>): void {
	const stash = getCallbacksByKey<T>(key);
	stash.push(callback);
	callbacks.set(key, stash);
}

function getCallbacksByKey<T>(key: string): Array<PromiseCallback<T>> {
	/* c8 ignore next 1 */
	return callbacks.get(key) ?? [];
}

async function enqueue<T>(key: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const callback: PromiseCallback<T> = {resolve, reject};
		addCallbackToKey(key, callback);
	});
}

function dequeue<T>(key: string): Array<PromiseCallback<T>> {
	const stash = getCallbacksByKey<T>(key);
	removeKey(key);
	return stash;
}

function coalesce<T>(options: {key: string; error?: Error; result?: T}): void {
	const {key, error, result} = options;

	for (const callback of dequeue(key)) {
		/* c8 ignore next 1 */
		if (error) {
			/* c8 ignore next 3 */
			callback.reject(error);
		} else {
			callback.resolve(result);
		}
	}
}

/**
 * Enqueue a promise for the group identified by `key`.
 *
 * All requests received for the same key while a request for that key
 * is already being executed will wait. Once the running request settles
 * then all the waiting requests in the group will settle, too.
 * This minimizes how many times the function itself runs at the same time.
 * This function resolves or rejects according to the given function argument.
 *
 * @url https://github.com/douglascayers/promise-coalesce
 */
export async function coalesceAsync<T>(
	/**
   * Any identifier to group requests together.
   */
	key: string,
	/**
   * The function to run.
   */
	fnc: () => T | PromiseLike<T>,
): Promise<T> {
	if (!hasKey(key)) {
		addKey(key);
		try {
			const result = await Promise.resolve(fnc());
			coalesce({key, result});
			return result;
		/* c8 ignore next 1 */
		} catch (error: any) {
			/* c8 ignore next 5 */
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			coalesce({key, error});

			throw error;
		}
	}

	return enqueue(key);
}
