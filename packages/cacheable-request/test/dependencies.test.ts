import {readFileSync} from 'node:fs';
import {test, expect} from 'vitest';

test('@types/http-cache-semantics is a regular (not dev) dependency', () => {
	// Required to avoid `Could not find a declaration file for module 'http-cache-semantics'` error from `tsc` when using this package in other projects

	// Arrange
	const packageJsonContents = JSON.parse(
		readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
	);

	// Assert
	expect(packageJsonContents).toHaveProperty('dependencies.@types/http-cache-semantics');
});
