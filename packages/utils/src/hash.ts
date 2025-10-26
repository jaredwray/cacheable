import * as crypto from "node:crypto";

export enum HashAlgorithm {
	SHA256 = "sha256",
	SHA512 = "sha512",
	MD5 = "md5",
	DJB2 = "djb2",
}

export type HashOptions = {
	algorithm?: HashAlgorithm;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	serialize?: (object: any) => string;
};

export type hashToNumberOptions = HashOptions & {
	min?: number;
	max?: number;
};

/**
 * Hashes an object using the specified algorithm. The default algorithm is 'sha256'.
 * @param object The object to hash
 * @param options The hash options to use
 * @returns {string} The hash of the object
 */
export function hash(
	// biome-ignore lint/suspicious/noExplicitAny: type format
	object: any,
	options: HashOptions = {
		algorithm: HashAlgorithm.SHA256,
		serialize: JSON.stringify,
	},
): string {
	if (!options?.algorithm) {
		options.algorithm = HashAlgorithm.SHA256;
	}

	if (!options?.serialize) {
		options.serialize = JSON.stringify;
	}

	// Convert the object to a string
	const objectString = options.serialize(object);

	if (options?.algorithm === HashAlgorithm.DJB2) {
		return djb2Hash(objectString);
	}

	// Check if the algorithm is supported
	if (!crypto.getHashes().includes(options.algorithm)) {
		throw new Error(`Unsupported hash algorithm: '${options?.algorithm}'`);
	}

	const hasher = crypto.createHash(options.algorithm);
	hasher.update(objectString);
	return hasher.digest("hex");
}

export function hashToNumber(
	// biome-ignore lint/suspicious/noExplicitAny: type format
	object: any,
	options: hashToNumberOptions = {
		min: 0,
		max: 10,
		algorithm: HashAlgorithm.SHA256,
		serialize: JSON.stringify,
	},
): number {
	const min = options?.min ?? 0;
	const max = options?.max ?? 10;

	if (min >= max) {
		throw new Error(
			`Invalid range: min (${min}) must be less than max (${max})`,
		);
	}

	if (!options?.algorithm) {
		options.algorithm = HashAlgorithm.SHA256;
	}

	if (!options?.serialize) {
		options.serialize = JSON.stringify;
	}

	// Create hash of the object
	const hashResult = hash(object, options);

	// Convert the hex string to a number (base 16)
	const hashNumber = Number.parseInt(hashResult, 16);

	// Calculate the range size
	const range = max - min + 1;

	// Return a number within the specified range
	const result = min + (hashNumber % range);
	if (result < min) {
		return min;
	}

	/* v8 ignore next -- @preserve */
	if (result > max) {
		return max;
	}

	return result;
}

export function djb2Hash(string_: string): string {
	// DJB2 hash algorithm
	let hash = 5381;
	for (let i = 0; i < string_.length; i++) {
		hash = (hash * 33) ^ string_.charCodeAt(i); // 33 is a prime multiplier
	}

	// Return a value within the specified range
	return hash.toString();
}
