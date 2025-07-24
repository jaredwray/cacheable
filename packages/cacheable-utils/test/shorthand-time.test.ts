import {describe, test, expect} from 'vitest';
import {shorthandToMilliseconds, shorthandToTime} from '../src/shorthand-time.js';

describe('time parser', () => {
	test('send in number', () => {
		expect(shorthandToMilliseconds(1000)).toBe(1000);
	});
	test('send in string with milliseconds', () => {
		expect(shorthandToMilliseconds('1ms')).toBe(1);
	});
	test('send in string', () => {
		expect(shorthandToMilliseconds('1s')).toBe(1000);
	});
	test('send in string with spaces', () => {
		expect(shorthandToMilliseconds('1 s')).toBe(1000);
	});
	test('send in string with decimal', () => {
		expect(shorthandToMilliseconds('1.5s')).toBe(1500);
	});
	test('send in string with minutes', () => {
		expect(shorthandToMilliseconds('1m')).toBe(60_000);
	});
	test('send in string with hours', () => {
		expect(shorthandToMilliseconds('1h')).toBe(3_600_000);
	});
	test('send in string with days', () => {
		expect(shorthandToMilliseconds('1d')).toBe(86_400_000);
	});
	test('send in string with unsupported unit', () => {
		expect(() => shorthandToMilliseconds('1z')).toThrowError('Unsupported time format: "1z". Use \'ms\', \'s\', \'m\', \'h\', \'hr\', or \'d\'.');
	});
	test('send in string with number', () => {
		expect(shorthandToMilliseconds('1000')).toBe(1000);
	});
	test('send in string with number and decimal', () => {
		expect(shorthandToMilliseconds('1.5h')).toBe(5_400_000);
	});
	test('send in string with number and decimal', () => {
		expect(shorthandToMilliseconds('1.5hr')).toBe(5_400_000);
	});
});

describe('parse to time', () => {
	test('send in number', () => {
		expect(shorthandToTime(1000)).toBeGreaterThan(Date.now());
	});

	test('send in string', () => {
		expect(shorthandToTime('10s')).toBeGreaterThan(Date.now());
	});

	test('send in nothing', () => {
		expect(shorthandToTime()).toBeDefined();
	});
});
