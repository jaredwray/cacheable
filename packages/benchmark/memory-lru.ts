import { createBenchmark, getModuleName, printToConsole, generateAlphaNumeric } from "index.js";
import { CacheableMemory } from "cacheable";
import QuickLRU from 'quick-lru';
import { createLRU } from 'lru.min';

const bench = createBenchmark("Memory LRU Benchmark", 100000);

// Cacheable Memory
const cacheable = new CacheableMemory({ storeHashSize: 1, lruSize: 80000 });
let cacheableName = getModuleName("Cacheable Memory", "1.10.0");

// QuickLRU
const quickLRU = new QuickLRU({maxSize: 80000});
let quickLRUName = getModuleName("quick-lru");

// lru.min
const lruMin = createLRU({ max: 80000 });
let lruMinName = getModuleName("lru.min");

// Map
const map = new Map<string, string>();
let mapName = getModuleName("Map", "22");

bench.add(`${cacheableName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	cacheable.set(alphaNumericData.key, alphaNumericData.value);
	cacheable.get(alphaNumericData.key);
});

bench.add(`${quickLRUName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	quickLRU.set(alphaNumericData.key, alphaNumericData.value);
	quickLRU.get(alphaNumericData.key);
});

bench.add(`${lruMinName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	lruMin.set(alphaNumericData.key, alphaNumericData.value);
	lruMin.get(alphaNumericData.key);
});

bench.add(`${mapName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	map.set(alphaNumericData.key, alphaNumericData.value);
	map.get(alphaNumericData.key);
});

await bench.run();

console.log(`*${bench.name} Results:*`);
printToConsole(bench);
