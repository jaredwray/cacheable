
export function getTtlFromExpires(expires: number | undefined): number | undefined {
	if (expires === undefined) {
		return undefined;
	}

	const now = Date.now();
	if (expires < now) {
		return undefined;
	}

	return expires - now;
}
