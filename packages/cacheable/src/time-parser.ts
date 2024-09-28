
export const parseToMilliseconds = (time: string | number): number => {
	let milliseconds: number;

	if (typeof time === 'number') {
		milliseconds = time;
	} else if (typeof time === 'string') {
		time = time.trim();

		// Check if the string is purely numeric
		if (Number.isNaN(Number(time))) {
			// Use a case-insensitive regex that supports decimals and 'ms' unit
			const match = /^([\d.]+)\s*(ms|s|m|h|d)$/i.exec(time);

			if (!match) {
				throw new Error(
					`Unsupported time format: "${time}". Use 'ms', 's', 'm', 'h', or 'd'.`,
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

				default: {
					throw new Error(
						`Unsupported time unit: "${unit}". Use 'ms', 's', 'm', 'h', or 'd'.`,
					);
				}
			}
		} else {
			milliseconds = Number(time);
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

