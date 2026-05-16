import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		fileParallelism: false,
		maxConcurrency: 1,
		maxWorkers: 1,
		// Node 24 promotes async request-lifecycle errors (e.g. ECONNRESET from
		// aborted requests) to uncaughtException where Node 20/22 swallowed them
		// at the libuv layer. The test suite uses cacheable-request's emit-based
		// API where errors are opt-in via .on('error', ...). Tracking issue for
		// the per-test audit/cleanup so we can drop this flag.
		dangerouslyIgnoreUnhandledErrors: true,
		coverage: {
			provider: 'v8',
			reporter: ['json', 'text', 'lcov'],
			exclude: [
				'test',
				'src/cacheable-item-types.ts',
				'vitest.config.ts',
				'dist',
				'node_modules',
			],
		},
	},
});
