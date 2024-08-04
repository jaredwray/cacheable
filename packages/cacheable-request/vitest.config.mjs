import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				'site/docula.config.cjs',
				'site-output/**',
				'.pnp.*',
				'.yarn/**',
			],
		},
	},
});
