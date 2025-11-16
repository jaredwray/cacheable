import { Hashery } from "hashery";

export enum HashAlgorithm {
	SHA256 = "SHA-256",
	SHA384 = "SHA-384",
	SHA512 = "SHA-512",
	DJB2 = "djb2",
	FNV1 = "fnv1",
	MURMER = "murmer",
	CRC32 = "crc32",
}

export type HashOptions = {
	algorithm?: HashAlgorithm;
	// biome-ignore lint/suspicious/noExplicitAny: type format
	serialize?: (object: any) => string;
};

export type HashToNumberOptions = HashOptions & {
	min?: number;
	max?: number;
	hashLength?: number;
};

/**
 * Hashes an object asynchronously using the specified cryptographic algorithm.
 * This method should be used for cryptographic algorithms (SHA-256, SHA-384, SHA-512).
 * For non-cryptographic algorithms, use hashSync() for better performance.
 * @param object The object to hash
 * @param options The hash options to use
 * @returns {Promise<string>} The hash of the object
 */
export async function hash(
	// biome-ignore lint/suspicious/noExplicitAny: type format
	object: any,
	options: HashOptions = {
		algorithm: HashAlgorithm.SHA256,
		serialize: JSON.stringify,
	},
): Promise<string> {
	const algorithm = options?.algorithm ?? HashAlgorithm.SHA256;
	const serialize = options?.serialize ?? JSON.stringify;

	// Convert the object to a string
	const objectString = serialize(object);

	const hashery = new Hashery();
	return hashery.toHash(objectString, { algorithm });
}

/**
 * Hashes an object synchronously using the specified non-cryptographic algorithm.
 * This method should be used for non-cryptographic algorithms (DJB2, FNV1, MURMER, CRC32).
 * For cryptographic algorithms, use hash() instead.
 * @param object The object to hash
 * @param options The hash options to use
 * @returns {string} The hash of the object
 */
export function hashSync(
	// biome-ignore lint/suspicious/noExplicitAny: type format
	object: any,
	options: HashOptions = {
		algorithm: HashAlgorithm.DJB2,
		serialize: JSON.stringify,
	},
): string {
	const algorithm = options?.algorithm ?? HashAlgorithm.DJB2;
	const serialize = options?.serialize ?? JSON.stringify;

	// Convert the object to a string
	const objectString = serialize(object);

	const hashery = new Hashery();
	return hashery.toHashSync(objectString, { algorithm });
}

/**
 * Hashes an object asynchronously and converts it to a number within a specified range.
 * This method should be used for cryptographic algorithms (SHA-256, SHA-384, SHA-512).
 * For non-cryptographic algorithms, use hashToNumberSync() for better performance.
 * @param object The object to hash
 * @param options The hash options to use including min/max range
 * @returns {Promise<number>} A number within the specified range
 */
export async function hashToNumber(
	// biome-ignore lint/suspicious/noExplicitAny: type format
	object: any,
	options: HashToNumberOptions = {
		min: 0,
		max: 10,
		algorithm: HashAlgorithm.SHA256,
		serialize: JSON.stringify,
	},
): Promise<number> {
	const min = options?.min ?? 0;
	const max = options?.max ?? 10;
	const algorithm = options?.algorithm ?? HashAlgorithm.SHA256;
	const serialize = options?.serialize ?? JSON.stringify;
	const hashLength = options?.hashLength ?? 16;

	if (min >= max) {
		throw new Error(
			`Invalid range: min (${min}) must be less than max (${max})`,
		);
	}

	// Convert the object to a string
	const objectString = serialize(object);

	const hashery = new Hashery();
	return hashery.toNumber(objectString, {
		algorithm,
		min,
		max,
		hashLength,
	});
}

/**
 * Hashes an object synchronously and converts it to a number within a specified range.
 * This method should be used for non-cryptographic algorithms (DJB2, FNV1, MURMER, CRC32).
 * For cryptographic algorithms, use hashToNumber() instead.
 * @param object The object to hash
 * @param options The hash options to use including min/max range
 * @returns {number} A number within the specified range
 */
export function hashToNumberSync(
	// biome-ignore lint/suspicious/noExplicitAny: type format
	object: any,
	options: HashToNumberOptions = {
		min: 0,
		max: 10,
		algorithm: HashAlgorithm.DJB2,
		serialize: JSON.stringify,
	},
): number {
	const min = options?.min ?? 0;
	const max = options?.max ?? 10;
	const algorithm = options?.algorithm ?? HashAlgorithm.DJB2;
	const serialize = options?.serialize ?? JSON.stringify;
	const hashLength = options?.hashLength ?? 16;

	if (min >= max) {
		throw new Error(
			`Invalid range: min (${min}) must be less than max (${max})`,
		);
	}

	// Convert the object to a string
	const objectString = serialize(object);

	const hashery = new Hashery();
	return hashery.toNumberSync(objectString, {
		algorithm,
		min,
		max,
		hashLength,
	});
}
