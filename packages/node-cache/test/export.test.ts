import {describe, test, expect} from 'vitest';
import {NodeCache} from '../src/index.js';

const cache = new NodeCache({checkperiod: 0});

describe('NodeCache', () => {
	test('should create a new instance of NodeCache', () => {
		const cache = new NodeCache({checkperiod: 0});
		expect(cache).toBeInstanceOf(NodeCache);
	});
});
