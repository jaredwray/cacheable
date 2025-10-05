import { Keyv } from "keyv";

// biome-ignore lint/suspicious/noExplicitAny: type format
export function isKeyvInstance(keyv: any): boolean {
	// Check if the object is an instance of Keyv
	if (keyv instanceof Keyv) {
		return true;
	}

	// Check if the object has the Keyv methods and properties
	const keyvMethods = [
		"generateIterator",
		"get",
		"getMany",
		"set",
		"setMany",
		"delete",
		"deleteMany",
		"has",
		"hasMany",
		"clear",
		"disconnect",
		"serialize",
		"deserialize",
	];
	return keyvMethods.every((method) => typeof keyv[method] === "function");
}
