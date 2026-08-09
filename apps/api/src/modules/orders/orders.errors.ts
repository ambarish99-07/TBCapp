/** Thrown for any order-creation input that's well-formed but not acceptable (unknown user, out of delivery zone, etc.). Caught in orders.controller.ts and returned as 400. */
export class OrderValidationError extends Error {}
