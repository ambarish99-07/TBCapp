/** Single rounding rule for all money math in this package — INR amounts round to whole rupees. */
export function round(amount: number): number {
  return Math.round(amount);
}
