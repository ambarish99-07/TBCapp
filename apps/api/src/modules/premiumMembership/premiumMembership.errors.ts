/** Thrown for any premium-membership input/action that's well-formed but not acceptable.
 * Caught in premiumMembership.controller.ts and returned as 400. */
export class PremiumMembershipValidationError extends Error {}
