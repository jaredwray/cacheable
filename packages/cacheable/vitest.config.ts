import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		slowTestThreshold: 750,
		coverage: {
			reporter: ['json', 'text', 'lcov'],
			exclude: [
				'test',
				'src/types.ts',
				'src/enums.ts',
				'vitest.config.ts',
				'dist',
				'node_modules',
			],
		},
	},
});
