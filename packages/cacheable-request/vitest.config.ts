import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		fileParallelism: false,
		maxConcurrency: 1,
		maxWorkers: 1,
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
