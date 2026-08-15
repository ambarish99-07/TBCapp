import { z } from "zod";
import { PaymentInfoSchema, PaymentMethodSchema } from "./order.js";

/** Flat price and duration — never hardcoded anywhere else in the application. */
export const PREMIUM_MEMBERSHIP_PRICE = 39;
export const PREMIUM_MEMBERSHIP_DURATION_DAYS = 30;

/** Own payment shape — extends the generic order `PaymentInfoSchema` with a `refundAmount`,
 * same convention as tiffin.ts's `TiffinPaymentInfoSchema`, kept as its own named schema rather
 * than reused across domains so a change to one payment flow never has to consider the other. */
export const PremiumMembershipPaymentInfoSchema = PaymentInfoSchema.extend({
  refundAmount: z.number().min(0).optional(),
});
export type PremiumMembershipPaymentInfo = z.infer<typeof PremiumMembershipPaymentInfoSchema>;

export const PremiumMembershipStatusSchema = z.object({
  active: z.boolean(),
  /** ISO date-time string — present whenever the account has ever purchased a membership, even if it's since expired. */
  expiresAt: z.string().optional(),
});
export type PremiumMembershipStatus = z.infer<typeof PremiumMembershipStatusSchema>;

/** No delivery address needed — a membership isn't delivered. */
export const PurchasePremiumMembershipRequestSchema = z.object({
  paymentMethod: PaymentMethodSchema,
});
export type PurchasePremiumMembershipRequest = z.infer<typeof PurchasePremiumMembershipRequestSchema>;

/** Full persisted/returned purchase shape. */
export const PremiumMembershipPurchaseSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  userId: z.string(),
  price: z.number().positive(),
  /** ISO calendar date (yyyy-mm-dd) this purchase was made. */
  startDate: z.string(),
  /** ISO calendar date (yyyy-mm-dd) membership runs until — extended from the account's current
   * expiry if it was already active, not reset to a flat 30 days from today. */
  expiresAt: z.string(),
  payment: PremiumMembershipPaymentInfoSchema,
  createdAt: z.string(),
});
export type PremiumMembershipPurchase = z.infer<typeof PremiumMembershipPurchaseSchema>;
