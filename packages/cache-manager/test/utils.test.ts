import {
	describe, vi, it, expect,
} from 'vitest';
import {conditionalAwait} from '../src/utils.ts';

describe('utils', () => {
	describe('conditionalAwait', () => {
		const longTask = vi.fn(async () => new Promise<void>(resolve => {
			setTimeout(() => {
				resolve(undefined);
			}, 1000);
		}));

		it('should await function when blocking is true', async () => {
			const start = Date.now();
			await conditionalAwait(longTask, true);
			const duration = Date.now() - start;

			expect(longTask).toHaveBeenCalled();
			expect(duration).toBeGreaterThanOrEqual(1000);
		});

		it('should not await function when blocking is false', async () => {
			const start = Date.now();
			await conditionalAwait(longTask, false);
			const duration = Date.now() - start;

			expect(longTask).toHaveBeenCalled();
			expect(duration).toBeLessThan(100); // Should proceed almost immediately
		});
	});
});
