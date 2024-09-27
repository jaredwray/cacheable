import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			reporter: ['json', 'text'],
			exclude: ['test', 'vite.config.ts', 'dist', 'node_modules'],
		},
	},
});
