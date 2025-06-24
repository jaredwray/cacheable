import { createBenchmark, getModuleName, printToConsole, generateAlphaNumeric } from "index.js";
import { NodeCache as CacheableNodeCache } from "@cacheable/node-cache";
import NodeCache from 'node-cache';

const bench = createBenchmark("NodeCache Benchmark", 100000);

// Cacheable NodeCache
const cacheable = new CacheableNodeCache();
let cacheableName = getModuleName("Cacheable NodeCache");

// Node Cache
const nodeCache = new NodeCache();
let nodeCacheName = getModuleName("Node Cache");


bench.add(`${cacheableName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	cacheable.set(alphaNumericData.key, alphaNumericData.value);
	cacheable.get(alphaNumericData.key);
});

bench.add(`${nodeCacheName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	nodeCache.set(alphaNumericData.key, alphaNumericData.value);
	nodeCache.get(alphaNumericData.key);
});

await bench.run();

console.log(`*${bench.name} Results:*`);
printToConsole(bench);
