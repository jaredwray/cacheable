
export const parseToMilliseconds = (shorthand: string | number): number => {
	let milliseconds: number;

	if (typeof shorthand === 'number') {
		milliseconds = shorthand;
	} else if (typeof shorthand === 'string') {
		shorthand = shorthand.trim();

		// Check if the string is purely numeric
		if (Number.isNaN(Number(shorthand))) {
			// Use a case-insensitive regex that supports decimals and 'ms' unit
			const match = /^([\d.]+)\s*(ms|s|m|h|d)$/i.exec(shorthand);

			if (!match) {
				throw new Error(
					`Unsupported time format: "${shorthand}". Use 'ms', 's', 'm', 'h', or 'd'.`,
				);
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

export const parseToTime = (time: string | number, fromDate?: Date): number => {
	fromDate ||= new Date();

	const milliseconds = parseToMilliseconds(time);
	return fromDate.getTime() + milliseconds;
};

