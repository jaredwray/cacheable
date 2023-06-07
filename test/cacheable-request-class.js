import { request } from 'http';
import test from 'ava';
import CacheableRequest from 'this';

test('CacheableRequest is a function', t => {
	t.is(typeof CacheableRequest, 'function');
});

test('CacheableRequest cannot be invoked without \'new\'', t => {
	t.throws(() => CacheableRequest(request)); // eslint-disable-line new-cap
	t.notThrows(() => new CacheableRequest(request));
});

test('CacheableRequest throws TypeError if request fn isn\'t passed in', t => {
	const error = t.throws(() => {
		new CacheableRequest(); // eslint-disable-line no-new
	}, TypeError);
	t.is(error.message, 'Parameter `request` must be a function');
});
