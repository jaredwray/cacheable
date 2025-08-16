// biome-ignore-all lint/suspicious/noExplicitAny: benchmarks
import { faker } from "@faker-js/faker";
import { tinybenchPrinter } from "@monstermann/tinybench-pretty-printer";
import { ObjectGenerator } from "object-generator.js";
import { Bench } from "tinybench";
import pkg from "../package.json" with { type: "json" };

export function createBenchmark(name: string, iterations: number) {
	const bench = new Bench({
		name,
		iterations,
	});

	return bench;
}

export function getModuleName(module: string, version?: string) {
	let result = module;

	if (version) {
		return `${module} (v${version})`;
	}

	if (pkg.name.toLowerCase() === module.toLowerCase()) {
		result = `${pkg.name} (v${pkg.version})`;
	} else {
		for (const [key, value] of Object.entries(pkg.dependencies)) {
			if (key.toLowerCase() === module.toLowerCase()) {
				let version = value;
				// Remove the caret (^) and tilde (~) from the version string
				version = version.replace(/^\D*/, "");
				// Remove any trailing characters that are not numbers or dots
				version = version.replace(/[^\d.]*$/, "");
				// Remove any leading characters that are not numbers or dots
				version = version.replace(/^[^\d.]*/, "");
				// Remove any leading zeros from the version string
				version = version.replaceAll(/^0+/g, "");

				result = `${key} (v${version})`;
				break;
			}
		}
	}

	return result;
}

export function printToConsole(bench: Bench) {
	const cli = tinybenchPrinter.toMarkdown(bench);
	console.log(cli);
	console.log("");
}

export function generateDataToArray(count: number) {
	const data: { key: string; value: string | number | object }[] = [];
	const mapData = generateDataToMap(count);
	for (const [key, value] of mapData) {
		data.push({ key, value });
	}
	return data;
}

/**
 * Generate random alphanumeric, numeric, or object data in a Map.
 * @param count The number of data points to generate
 */
export function generateDataToMap(count: number) {
	const data = new Map<string, string | number | object>();
	for (let i = 0; i < count; i++) {
		const randomNumber = faker.number.int({ min: 1, max: 3 });
		switch (randomNumber) {
			case 1: {
				const alphaNumericData = generateAlphaNumeric();
				data.set(alphaNumericData.key, alphaNumericData.value);
				break;
			}
			case 2: {
				const numericData = generateNumeric();
				data.set(numericData.key, numericData.value);
				break;
			}
			case 3: {
				const objectData = generateObject();
				data.set(objectData.key, objectData.value);
				break;
			}
		}
	}

	return data;
}

export function generateAlphaNumericData(count: number) {
	const data = new Map<string, string>();
	for (let i = 0; i < count; i++) {
		const alphaNumericData = generateAlphaNumeric();
		data.set(alphaNumericData.key, alphaNumericData.value);
	}
	return data;
}

export function generateAlphaNumeric() {
	const data = {
		key: faker.string.alphanumeric(10),
		value: faker.string.alphanumeric(100),
	};
	return data;
}

export function generateNumericData(count: number) {
	const data = new Map<string, number>();
	for (let i = 0; i < count; i++) {
		const numericData = generateNumeric();
		data.set(numericData.key, numericData.value);
	}
	return data;
}

export function generateNumeric() {
	const data = {
		key: faker.string.numeric(10),
		value: faker.number.int({ min: 1, max: 100000000 }),
	};
	return data;
}

export function generateObjectData(count: number) {
	const data = new Map<string, any>();
	for (let i = 0; i < count; i++) {
		const objectData = generateObject();
		data.set(objectData.key, objectData.value);
	}
	return data;
}

export function generateObject() {
	const objectGenerator = new ObjectGenerator();
	const randomNumber = faker.number.int({ min: 1, max: 10 });
	const data = {
		key: "",
		value: {},
	};

	switch (randomNumber) {
		case 1: {
			const user = objectGenerator.generateFakeUser();
			data.key = user.id;
			data.value = user;
			break;
		}
		case 2: {
			const product = objectGenerator.generateFakeProduct();
			data.key = product.id;
			data.value = product;
			break;
		}
		case 3: {
			const order = objectGenerator.generateFakeOrder();
			data.key = order.id;
			data.value = order;
			break;
		}
		case 4: {
			const company = objectGenerator.generateFakeCompany();
			data.key = company.id;
			data.value = company;
			break;
		}
		case 5: {
			const event = objectGenerator.generateFakeEvent();
			data.key = event.id;
			data.value = event;
			break;
		}
		case 6: {
			const review = objectGenerator.generateFakeReview();
			data.key = review.id;
			data.value = review;
			break;
		}
		case 7: {
			const car = objectGenerator.generateFakeCar();
			data.key = car.id;
			data.value = car;
			break;
		}
		case 8: {
			const payment = objectGenerator.generateFakePayment();
			data.key = payment.id;
			data.value = payment;
			break;
		}
		case 9: {
			const blogPost = objectGenerator.generateFakeBlogPost();
			data.key = blogPost.id;
			data.value = blogPost;
			break;
		}
		case 10: {
			const comment = objectGenerator.generateFakeComment();
			data.key = comment.id;
			data.value = comment;
			break;
		}
	}

	return data;
}
