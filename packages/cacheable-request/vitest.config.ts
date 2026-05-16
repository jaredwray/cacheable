import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		fileParallelism: false,
		maxConcurrency: 1,
		maxWorkers: 1,
		// Node 24 promotes a residual ECONNRESET from the raw http.ClientRequest
		// socket (before cacheable-request can forward it to its event emitter)
		// to an uncaughtException. Every cacheableRequest(...) chain in the test
		// suite already has .on('error', ...) handlers — this only catches the
		// pre-wrapper socket noise. Drop once the internal lifecycle is fixed.
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
