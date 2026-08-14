import { z } from "zod";
import { DeliveryDetailsSchema, PaymentInfoSchema, PaymentMethodSchema } from "./order.js";

export const TIFFIN_MEAL_TYPES = ["lunch", "dinner"] as const;
export const TiffinMealTypeSchema = z.enum(TIFFIN_MEAL_TYPES);
export type TiffinMealType = z.infer<typeof TiffinMealTypeSchema>;

/** "single" = one meal a day, the customer's choice of lunch or dinner (see
 * `CreateTiffinSubscriptionRequestSchema.mealType`). "twice-daily" = both lunch and dinner every
 * day, no choice needed — the plan itself decides, not the subscriber. */
export const TIFFIN_PLAN_STYLES = ["single", "twice-daily"] as const;
export const TiffinPlanStyleSchema = z.enum(TIFFIN_PLAN_STYLES);
export type TiffinPlanStyle = z.infer<typeof TiffinPlanStyleSchema>;

export const TiffinDietTypeSchema = z.enum(["veg", "non-veg"]);
export type TiffinDietType = z.infer<typeof TiffinDietTypeSchema>;

/** The one choice a veg subscriber makes — non-veg Sunday is always Mutton, no choice. */
export const SUNDAY_VEG_CHOICES = ["paneer", "chole"] as const;
export const SundayVegChoiceSchema = z.enum(SUNDAY_VEG_CHOICES);
export type SundayVegChoice = z.infer<typeof SundayVegChoiceSchema>;

/** Monday-first weekly veg sabzi rotation. Sunday isn't here — it's the customer's paneer/chole choice instead (see SUNDAY_VEG_CHOICES). */
export const TIFFIN_WEEKLY_VEG_ROTATION: Record<string, string> = {
  Monday: "Aloo Gobhi",
  Tuesday: "Aloo Matar",
  Wednesday: "Aloo Parwal",
  Thursday: "Aloo Soyabean",
  Friday: "Dum Aloo",
  Saturday: "Lauki",
};

/** Days the non-veg plan swaps in a meat curry instead of that day's veg sabzi. Every other
 * weekday (Tue/Thu/Sat) falls back to `TIFFIN_WEEKLY_VEG_ROTATION`'s sabzi for that day. */
export const TIFFIN_NONVEG_CURRY_DAYS: Record<string, string> = {
  Monday: "Chicken Curry",
  Wednesday: "Fish Curry",
  Friday: "Egg Curry",
};
/** Non-veg Sunday is always this — fixed, unlike the veg plan's paneer/chole choice. */
export const TIFFIN_NONVEG_SUNDAY_DISH = "Mutton Curry";

export const TIFFIN_PLAN_DURATIONS = { weekly: 7, monthly: 30 } as const;

/** Tiffin's own payment shape — extends the generic order `PaymentInfoSchema` with a
 * `refundAmount`, instead of widening the shared one that `Order` also relies on. */
export const TiffinPaymentInfoSchema = PaymentInfoSchema.extend({
  refundAmount: z.number().min(0).optional(),
});
export type TiffinPaymentInfo = z.infer<typeof TiffinPaymentInfoSchema>;

/** Weekly plans can't be cancelled at all. A monthly plan cancelled before this many days have
 * elapsed since its (next-day) start refunds `CANCELLATION_REFUND_PERCENT` of what was paid;
 * on or after it, no refund. */
export const CANCELLATION_FULL_REFUND_WINDOW_DAYS = 15;
export const CANCELLATION_REFUND_PERCENT = 0.5;

export const TiffinPlanSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  dietType: TiffinDietTypeSchema,
  style: TiffinPlanStyleSchema,
  durationDays: z.number().int().positive(),
  /** Flat price for the whole plan duration — never hardcoded in application code, always admin-editable. */
  price: z.number().positive(),
  active: z.boolean(),
  createdAt: z.string(),
});
export type TiffinPlan = z.infer<typeof TiffinPlanSchema>;

export const CreateTiffinPlanRequestSchema = z.object({
  name: z.string().min(1),
  dietType: TiffinDietTypeSchema,
  style: TiffinPlanStyleSchema,
  durationDays: z.number().int().positive(),
  price: z.number().positive(),
  active: z.boolean().default(true),
});
export type CreateTiffinPlanRequest = z.infer<typeof CreateTiffinPlanRequestSchema>;

export const UpdateTiffinPlanRequestSchema = CreateTiffinPlanRequestSchema.partial();
export type UpdateTiffinPlanRequest = z.infer<typeof UpdateTiffinPlanRequestSchema>;

export const TiffinScheduledMealStatusSchema = z.enum([
  "scheduled",
  "skipped",
  "preparing",
  "out-for-delivery",
  "delivered",
  "cancelled",
]);
export type TiffinScheduledMealStatus = z.infer<typeof TiffinScheduledMealStatusSchema>;

export const TiffinScheduledMealSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  /** ISO calendar date (yyyy-mm-dd) — this is a specific day's meal, not a timestamp. */
  date: z.string(),
  mealType: TiffinMealTypeSchema,
  dishName: z.string(),
  status: TiffinScheduledMealStatusSchema,
});
export type TiffinScheduledMeal = z.infer<typeof TiffinScheduledMealSchema>;

export const TiffinSubscriptionStatusSchema = z.enum(["active", "paused", "completed", "cancelled"]);
export type TiffinSubscriptionStatus = z.infer<typeof TiffinSubscriptionStatusSchema>;

/** What the client POSTs to subscribe — no price, no schedule, server derives everything from the plan.
 * `mealType` is required only for a "single" style plan (the customer's lunch/dinner choice) — a
 * "twice-daily" plan ignores it and always schedules both. */
export const CreateTiffinSubscriptionRequestSchema = z.object({
  planId: z.string(),
  mealType: TiffinMealTypeSchema.optional(),
  sundayVegChoice: SundayVegChoiceSchema.optional(),
  delivery: DeliveryDetailsSchema,
  paymentMethod: PaymentMethodSchema,
});
export type CreateTiffinSubscriptionRequest = z.infer<typeof CreateTiffinSubscriptionRequestSchema>;

export const PauseTiffinSubscriptionRequestSchema = z.object({
  /** Both ISO calendar dates (yyyy-mm-dd), inclusive. */
  from: z.string(),
  until: z.string(),
});
export type PauseTiffinSubscriptionRequest = z.infer<typeof PauseTiffinSubscriptionRequestSchema>;

/** Full persisted/returned subscription shape. */
export const TiffinSubscriptionSchema = z.object({
  id: z.string(),
  subscriptionNumber: z.string(),
  userId: z.string(),
  planId: z.string(),
  /** Snapshotted at subscribe time — a later plan-name edit shouldn't retroactively rewrite a past subscription's display. */
  planName: z.string(),
  dietType: TiffinDietTypeSchema,
  style: TiffinPlanStyleSchema,
  /** What was actually subscribed — `["lunch"]` or `["dinner"]` for a "single" plan, `["lunch", "dinner"]` for "twice-daily". */
  mealTypes: z.array(TiffinMealTypeSchema).min(1),
  sundayVegChoice: SundayVegChoiceSchema.optional(),
  status: TiffinSubscriptionStatusSchema,
  /** Snapshotted at subscribe time — determines cancellation eligibility (weekly plans can't be
   * cancelled) independent of any later pause-driven extension to `endDate`. */
  durationDays: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string(),
  pausedFrom: z.string().optional(),
  pausedUntil: z.string().optional(),
  cancelledAt: z.string().optional(),
  delivery: DeliveryDetailsSchema,
  /** Snapshotted at subscribe time — a later plan-price edit shouldn't retroactively alter what was already paid. */
  price: z.number().positive(),
  payment: TiffinPaymentInfoSchema,
  createdAt: z.string(),
});
export type TiffinSubscription = z.infer<typeof TiffinSubscriptionSchema>;
