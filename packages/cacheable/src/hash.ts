import * as crypto from "node:crypto";

/**
 * Hashes an object using the specified algorithm. The default algorithm is 'sha256'.
 * @param object The object to hash
 * @param algorithm The hash algorithm to use
 * @returns {string} The hash of the object
 */
// biome-ignore lint/suspicious/noExplicitAny: type format
export function hash(object: any, algorithm = "sha256"): string {
	// Convert the object to a string
	const objectString = JSON.stringify(object);

	// Check if the algorithm is supported
	if (!crypto.getHashes().includes(algorithm)) {
		throw new Error(`Unsupported hash algorithm: '${algorithm}'`);
	}

	const hasher = crypto.createHash(algorithm);
	hasher.update(objectString);
	return hasher.digest("hex");
}

export function hashToNumber(
	// biome-ignore lint/suspicious/noExplicitAny: type format
	object: any,
	min = 0,
	max = 10,
	algorithm = "sha256",
): number {
	// Convert the object to a string
	const objectString = JSON.stringify(object);

	// Check if the algorithm is supported
	if (!crypto.getHashes().includes(algorithm)) {
		throw new Error(`Unsupported hash algorithm: '${algorithm}'`);
	}

	// Create a hasher and update it with the object string
	const hasher = crypto.createHash(algorithm);
	hasher.update(objectString);

	// Get the hash as a hexadecimal string
	const hashHex = hasher.digest("hex");

	// Convert the hex string to a number (base 16)
	const hashNumber = Number.parseInt(hashHex, 16);

	// Calculate the range size
	const range = max - min + 1;

	// Return a number within the specified range
	return min + (hashNumber % range);
}

export function djb2Hash(string_: string, min = 0, max = 10): number {
	// DJB2 hash algorithm
	let hash = 5381;
	for (let i = 0; i < string_.length; i++) {
		hash = (hash * 33) ^ string_.charCodeAt(i); // 33 is a prime multiplier
	}

	// Calculate the range size
	const range = max - min + 1;

	// Return a value within the specified range
	return min + (Math.abs(hash) % range);
}
