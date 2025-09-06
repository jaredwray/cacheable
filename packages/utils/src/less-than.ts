export function lessThan(number1?: number, number2?: number) {
	return typeof number1 === "number" && typeof number2 === "number"
		? number1 < number2
		: false;
}
