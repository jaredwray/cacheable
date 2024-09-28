import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			reporter: ['json', 'text'],
			exclude: ['test', 'src/cacheable-item-types.ts', 'vite.config.ts', 'dist', 'node_modules'],
		},
	},
});
