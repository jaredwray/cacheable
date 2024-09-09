import {describe, test, expect} from 'vitest';
import NodeCache from '../src/index.js';

describe('NodeCache', () => {
	test('should create a new instance of NodeCache', () => {
		const cache = new NodeCache();
		expect(cache).toBeInstanceOf(NodeCache);
	});
});
