import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		slowTestThreshold: 750,
		coverage: {
			reporter: ['json', 'text'],
			exclude: ['test', 'src/cacheable-item-types.ts', 'vite.config.ts', 'dist', 'node_modules'],
		},
	},
});
