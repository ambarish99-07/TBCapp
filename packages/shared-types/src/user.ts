import { z } from "zod";

export const UserRoleSchema = z.enum(["customer", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * completedOrderCount alone drives quantity-tier discount milestones (6th/10th
 * order cycles) and premium-membership unlocking (15+ orders) — see @tbc/pricing.
 * isPremiumMemberOverride lets an admin manually grant premium regardless of count.
 */
export const LoyaltyStateSchema = z.object({
  completedOrderCount: z.number().int().nonnegative(),
  isPremiumMemberOverride: z.boolean(),
});
export type LoyaltyState = z.infer<typeof LoyaltyStateSchema>;

/** Public-facing user shape — never includes passwordHash. */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string(),
  role: UserRoleSchema,
  loyalty: LoyaltyStateSchema,
});
export type User = z.infer<typeof UserSchema>;

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  phone: z.string().min(1),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
