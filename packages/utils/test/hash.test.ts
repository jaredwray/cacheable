import {describe, test, expect} from 'vitest';
import {hash, hashToNumber, HashAlgorithm} from '../src/hash.js';

describe('hash', () => {
	test('hashes an object using the specified algorithm', () => {
		// Arrange
		const object = {foo: 'bar'};
		const algorithm = HashAlgorithm.SHA256;

		// Act
		const result = hash(object, algorithm);

		// Assert
		expect(result).toBe('7a38bf81f383f69433ad6e900d35b3e2385593f76a7b7ab5d4355b8ba41ee24b');
	});
	test('hashes a string using the default algorithm', () => {
		// Arrange
		const object = 'foo';

		// Act
		const result = hash(object);

		// Assert
		expect(result).toBe('b2213295d564916f89a6a42455567c87c3f480fcd7a1c15e220f17d7169a790b');
	});

	test('hashes a number using the default algorithm', () => {
		// Arrange
		const object = '123';

		// Act
		const result = hashToNumber(object);

		// Assert
		expect(result).toBeDefined();
	});

	test('throws an error when the algorithm is not supported', () => {
		// @ts-expect-error testing unsupported algorithm
		expect(() => hash('foo', 'md5foo')).toThrowError('Unsupported hash algorithm: \'md5foo\'');
	});

	test('hashes an object using the DJB2 algorithm', () => {
		// Arrange
		const object = {foo: 'bar'};
		const algorithm = HashAlgorithm.DJB2;

		// Act
		const result = hash(object, algorithm);

		// Assert
		expect(result).toBe('717564430');
	});

	test('hashToNumber returns a number within the specified range', () => {
		// Arrange
		const hashValue = hash({foo: 'bar'}, HashAlgorithm.DJB2);
		const min = 0;
		const max = 10;

		// Act
		const result = hashToNumber(hashValue, min, max);

		// Assert
		expect(result).toBeGreaterThanOrEqual(min);
		expect(result).toBeLessThanOrEqual(max);
	});

	test('hashToNumber the same number for the same object', () => {
		// Arrange
		const hashValue = hash({foo: 'bar'}, HashAlgorithm.DJB2);
		const min = 0;
		const max = 10;

		// Act
		const result = hashToNumber(hashValue, min, max);
		const result2 = hashToNumber(hashValue, min, max);

		// Assert
		expect(result).toBe(result2);
	});
});
