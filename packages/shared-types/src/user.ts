import { z } from "zod";

export const UserRoleSchema = z.enum(["customer", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const LoyaltyStateSchema = z.object({
  completedOrderCount: z.number().int().nonnegative(),
  isGoldMember: z.boolean(),
});
export type LoyaltyState = z.infer<typeof LoyaltyStateSchema>;

export const PunchCardStateSchema = z.object({
  ordersSinceReward: z.number().int().nonnegative(),
});
export type PunchCardState = z.infer<typeof PunchCardStateSchema>;

/** Public-facing user shape — never includes passwordHash. */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string(),
  role: UserRoleSchema,
  loyalty: LoyaltyStateSchema,
  punchCard: PunchCardStateSchema,
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
