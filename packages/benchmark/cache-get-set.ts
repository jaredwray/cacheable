import { BentoCache, bentostore } from "bentocache";
import { memoryDriver } from "bentocache/drivers/memory";
import { createCache } from "cache-manager";
import { Cacheable } from "cacheable";
import {
	createBenchmark,
	generateAlphaNumeric,
	getModuleName,
	printToConsole,
} from "index.js";

const bench = createBenchmark("Memory Cache Benchmark", 100000);

// Cacheable
const cacheable = new Cacheable();
const cacheableName = getModuleName("Cacheable", "1.10.0");

// Cache Manager with Memory Store
const cacheManager = createCache();
const nodeCacheName = getModuleName("cache-manager", "7.0.0");

// BentoCache with Memory Driver
const bento = new BentoCache({
	default: "myCache",
	stores: {
		// A first cache store named "myCache" using
		// only L1 in-memory cache
		myCache: bentostore().useL1Layer(memoryDriver({ maxSize: "10mb" })),
	},
});
const bentoName = getModuleName("BentoCache");

bench.add(`${cacheableName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	await cacheable.set(alphaNumericData.key, alphaNumericData.value);
	await cacheable.get(alphaNumericData.key);
});

bench.add(`${nodeCacheName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	await cacheManager.set(alphaNumericData.key, alphaNumericData.value);
	await cacheManager.get(alphaNumericData.key);
});

bench.add(`${bentoName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	await bento.set({ key: alphaNumericData.key, value: alphaNumericData.value });
	await bento.get({ key: alphaNumericData.key });
});

await bench.run();

console.log(`*${bench.name} Results:*`);
printToConsole(bench);
