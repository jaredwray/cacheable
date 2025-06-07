import { createBenchmark, getModuleName, printToConsole, generateAlphaNumeric } from "index.js";
import { CacheableMemory } from "cacheable";
import NodeCache from 'node-cache';
import { BentoCache, bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';

const bench = createBenchmark("Memory Benchmark", 100000);

// Cacheable Memory
const cacheable = new CacheableMemory();
let cacheableName = getModuleName("Cacheable Memory", "1.10.0");

// Node Cache
const nodeCache = new NodeCache();
let nodeCacheName = getModuleName("Node Cache");

// BentoCache with Memory Driver
const bento = new BentoCache({
  default: 'myCache',
  stores: {
    // A first cache store named "myCache" using 
    // only L1 in-memory cache
    myCache: bentostore()
      .useL1Layer(memoryDriver({ maxSize: '10mb' }))
  }
});
let bentoName = getModuleName("BentoCache");

// Map
const map = new Map<string, string>();
let mapName = getModuleName("Map", "22");

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

bench.add(`${bentoName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	await bento.set({ key: alphaNumericData.key, value: alphaNumericData.value});
	await bento.get({ key: alphaNumericData.key});
});

bench.add(`${mapName} - set / get`, async () => {
	const alphaNumericData = generateAlphaNumeric();
	map.set(alphaNumericData.key, alphaNumericData.value);
	map.get(alphaNumericData.key);
});

await bench.run();

console.log(`*${bench.name} Results:*`);
printToConsole(bench);
