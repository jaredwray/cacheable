export type WrapScope = {
	write: (operation: () => Promise<unknown>) => Promise<boolean>;
	refresh: (operation: () => Promise<void>) => Promise<void>;
};

type Generation = Partial<Record<"read" | "refresh", Promise<unknown>>>;

// Each instance owns the active operations for one key in one cache.
export class WrapWrites {
	private generation: Generation = {};
	private tail = Promise.resolve();
	private active = 0;

	constructor(private readonly onIdle: () => void) {}

	wrap<T>(read: (scope: WrapScope) => Promise<T>): Promise<T> {
		const generation = this.generation;
		const precedingWrites = this.tail;
		return this.share(generation, "read", async () => {
			await precedingWrites;
			return read({
				write: (operation) =>
					this.enqueue(async () => {
						if (this.generation !== generation) {
							return false;
						}

						await operation();
						return true;
					}),
				refresh: (operation) => this.share(generation, "refresh", operation),
			});
		});
	}

	mutate<T>(operation: () => Promise<T>): Promise<T> {
		this.generation = {};
		return this.enqueue(operation);
	}

	private share<T>(
		generation: Generation,
		kind: keyof Generation,
		operation: () => Promise<T>,
	): Promise<T> {
		generation[kind] ??= this.track(
			Promise.resolve()
				.then(operation)
				.finally(() => {
					delete generation[kind];
				}),
		);
		return generation[kind] as Promise<T>;
	}

	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.track(this.tail.then(operation));
		// A failed write must release the next write for this key.
		this.tail = result.then(
			() => {},
			() => {},
		);
		return result;
	}

	private track<T>(operation: Promise<T>): Promise<T> {
		this.active++;
		return operation.finally(() => {
			this.active--;
			if (this.active === 0) {
				this.onIdle();
			}
		});
	}
}
