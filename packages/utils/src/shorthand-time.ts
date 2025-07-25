/**
 * Converts a shorthand time string or number into milliseconds.
 * The shorthand can be a string like '1s', '2m', '3h', '4d', or a number representing milliseconds.
 * If the input is undefined, it returns undefined.
 * If the input is a string that does not match the expected format, it throws an error.
 * @param shorthand - A shorthand time string or number representing milliseconds.
 * @returns The equivalent time in milliseconds or undefined.
 */
export const shorthandToMilliseconds = (shorthand?: string | number): number | undefined => {
	let milliseconds: number;

	if (shorthand === undefined) {
		return undefined;
	}

	if (typeof shorthand === 'number') {
		milliseconds = shorthand;
	} else if (typeof shorthand === 'string') {
		shorthand = shorthand.trim();

		// Check if the string is purely numeric
		if (Number.isNaN(Number(shorthand))) {
			// Use a case-insensitive regex that supports decimals and 'ms' unit
			const match = /^([\d.]+)\s*(ms|s|m|h|hr|d)$/i.exec(shorthand);

			if (!match) {
				throw new Error(`Unsupported time format: "${shorthand}". Use 'ms', 's', 'm', 'h', 'hr', or 'd'.`);
			}

			const [, value, unit] = match;
			const numericValue = Number.parseFloat(value);
			const unitLower = unit.toLowerCase();

			switch (unitLower) {
				case 'ms': {
					milliseconds = numericValue;
					break;
				}

				case 's': {
					milliseconds = numericValue * 1000;
					break;
				}

				case 'm': {
					milliseconds = numericValue * 1000 * 60;
					break;
				}

				case 'h': {
					milliseconds = numericValue * 1000 * 60 * 60;
					break;
				}

				case 'hr': {
					milliseconds = numericValue * 1000 * 60 * 60;
					break;
				}

				case 'd': {
					milliseconds = numericValue * 1000 * 60 * 60 * 24;
					break;
				}

				/* c8 ignore next 3 */
				default: {
					milliseconds = Number(shorthand);
				}
			}
			/* c8 ignore next 6 */
		} else {
			milliseconds = Number(shorthand);
		}
	} else {
		throw new TypeError('Time must be a string or a number.');
	}

	return milliseconds;
};

/**
 * Converts a shorthand time string or number into a timestamp.
 * If the shorthand is undefined, it returns the current date's timestamp.
 * If the shorthand is a valid time format, it adds that duration to the current date's timestamp.
 * @param shorthand - A shorthand time string or number representing milliseconds.
 * @param fromDate - An optional Date object to calculate from. Defaults to the current date if not provided.
 * @returns The timestamp in milliseconds since epoch.
 */
export const shorthandToTime = (shorthand?: string | number, fromDate?: Date): number => {
	fromDate ??= new Date();

	const milliseconds = shorthandToMilliseconds(shorthand);
	if (milliseconds === undefined) {
		return fromDate.getTime();
	}

	return fromDate.getTime() + milliseconds;
};

