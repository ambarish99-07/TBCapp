import type { User } from "@tbc/shared-types";

/**
 * Whether this account has everything needed to place an order without typing delivery
 * details again — drives the Cart screen's "Complete your profile" nudge and gates
 * Proceed to Pay. Phone is required because DeliveryDetailsSchema requires one, but
 * User.phone is optional (email-only signups exist).
 */
export function hasCompleteAddress(user: User | null): boolean {
  return !!(user?.address && user?.city && user?.pincode && user?.phone);
}
