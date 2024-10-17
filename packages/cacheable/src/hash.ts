import * as crypto from 'node:crypto';

/**
 * Hashes an object using the specified algorithm. The default algorithm is 'sha256'.
 * @param object The object to hash
 * @param algorithm The hash algorithm to use
 * @returns {string} The hash of the object
 */
export function hash(object: any, algorithm = 'sha256'): string {
	// Convert the object to a string
	const objectString = JSON.stringify(object);

	// Check if the algorithm is supported
	if (!crypto.getHashes().includes(algorithm)) {
		throw new Error(`Unsupported hash algorithm: '${algorithm}'`);
	}

	const hasher = crypto.createHash(algorithm);
	hasher.update(objectString);
	return hasher.digest('hex');
}
