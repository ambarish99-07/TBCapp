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

/**
 * Public-facing user shape — never includes passwordHash. email/phone are each
 * optional since an account can be created with just one of them (see
 * SignupRequestSchema) — but never both missing.
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  fullName: z.string(),
  phone: z.string().optional(),
  role: UserRoleSchema,
  loyalty: LoyaltyStateSchema,
});
export type User = z.infer<typeof UserSchema>;

/** Signup accepts email, phone, or both — at least one is required as the login identifier. */
export const SignupRequestSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).optional(),
    password: z.string().min(8),
    fullName: z.string().min(1),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "Provide an email or a phone number",
    path: ["email"],
  });
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

/** identifier is whatever the customer typed — either their email or their phone number. */
export const LoginRequestSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RequestOtpSchema = z.object({
  phone: z.string().min(7),
});
export type RequestOtpRequest = z.infer<typeof RequestOtpSchema>;

/** fullName is only required the first time — i.e. when this phone number has no account yet. */
export const VerifyOtpSchema = z.object({
  phone: z.string().min(7),
  otp: z.string().min(4),
  fullName: z.string().min(1).optional(),
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpSchema>;

/**
 * Two-phase: the code can be verified as correct before the account exists.
 * `requiresName` means "verified, but this phone has no account yet" — the
 * client collects a name and resubmits the same still-valid code instead of
 * treating this as an error.
 */
export const VerifyOtpResponseSchema = z.union([
  z.object({ requiresName: z.literal(true) }),
  z.object({ token: z.string(), user: UserSchema }),
]);
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;
