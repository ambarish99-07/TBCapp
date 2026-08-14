/** Thrown for any tiffin subscription input/action that's well-formed but not acceptable
 * (unknown/inactive plan, skip too late, wrong subscription state, etc.). Caught in
 * tiffin.controller.ts and returned as 400. */
export class TiffinValidationError extends Error {}
