import * as crypto from 'node:crypto';

export enum HashAlgorithm {
	SHA256 = 'sha256',
	SHA512 = 'sha512',
	MD5 = 'md5',
	DJB2 = 'djb2',
}

/**
 * Hashes an object using the specified algorithm. The default algorithm is 'sha256'.
 * @param object The object to hash
 * @param algorithm The hash algorithm to use
 * @returns {string} The hash of the object
 */
export function hash(object: any, algorithm: HashAlgorithm = HashAlgorithm.SHA256): string {
	// Convert the object to a string
	const objectString = JSON.stringify(object);

	if (algorithm === HashAlgorithm.DJB2) {
		return djb2Hash(objectString);
	}

	// Check if the algorithm is supported
	if (!crypto.getHashes().includes(algorithm)) {
		throw new Error(`Unsupported hash algorithm: '${algorithm}'`);
	}

	const hasher = crypto.createHash(algorithm);
	hasher.update(objectString);
	return hasher.digest('hex');
}

export function hashToNumber(object: any, min = 0, max = 10, algorithm: HashAlgorithm = HashAlgorithm.SHA256): number {
	// Create hash of the object
	const hashResult = hash(object, algorithm);

	// Convert the hex string to a number (base 16)
	const hashNumber = Number.parseInt(hashResult, 16);

	// Calculate the range size
	const range = max - min + 1;

	// Return a number within the specified range
	return min + (hashNumber % range);
}

export function djb2Hash(string_: string): string {
	// DJB2 hash algorithm
	let hash = 5381;
	for (let i = 0; i < string_.length; i++) {
		// eslint-disable-next-line no-bitwise, unicorn/prefer-code-point
		hash = (hash * 33) ^ string_.charCodeAt(i); // 33 is a prime multiplier
	}

	// Return a value within the specified range
	return hash.toString();
}
