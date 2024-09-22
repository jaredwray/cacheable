export function lt(num1?: number, num2?: number) {
  return typeof num1 === 'number' && typeof num2 === 'number' ? num1 < num2 : false
}
