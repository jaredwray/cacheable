import {describe, test, expect} from 'vitest';
import {parseToMilliseconds, parseToTime} from '../src/time-parser.js';

describe('time parser', () => {
	test('send in number', () => {
		expect(parseToMilliseconds(1000)).toBe(1000);
	});
	test('send in string with milliseconds', () => {
		expect(parseToMilliseconds('1ms')).toBe(1);
	});
	test('send in string', () => {
		expect(parseToMilliseconds('1s')).toBe(1000);
	});
	test('send in string with spaces', () => {
		expect(parseToMilliseconds('1 s')).toBe(1000);
	});
	test('send in string with decimal', () => {
		expect(parseToMilliseconds('1.5s')).toBe(1500);
	});
	test('send in string with minutes', () => {
		expect(parseToMilliseconds('1m')).toBe(60_000);
	});
	test('send in string with hours', () => {
		expect(parseToMilliseconds('1h')).toBe(3_600_000);
	});
	test('send in string with days', () => {
		expect(parseToMilliseconds('1d')).toBe(86_400_000);
	});
	test('send in string with unsupported unit', () => {
		expect(() => parseToMilliseconds('1z')).toThrowError('Unsupported time format: "1z". Use \'ms\', \'s\', \'m\', \'h\', \'hr\', or \'d\'.');
	});
	test('send in string with number', () => {
		expect(parseToMilliseconds('1000')).toBe(1000);
	});
	test('send in string with number and decimal', () => {
		expect(parseToMilliseconds('1.5h')).toBe(5_400_000);
	});
	test('send in string with number and decimal', () => {
		expect(parseToMilliseconds('1.5hr')).toBe(5_400_000);
	});
});

describe('parse to time', () => {
	test('send in number', () => {
		expect(parseToTime(1000)).toBeGreaterThan(Date.now());
	});

	test('send in string', () => {
		expect(parseToTime('10s')).toBeGreaterThan(Date.now());
	});

	test('send in nothing', () => {
		expect(parseToTime()).toBeDefined();
	});
});
