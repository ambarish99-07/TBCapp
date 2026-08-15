import { z } from "zod";
import { DeliveryDetailsSchema, PaymentInfoSchema, PaymentMethodSchema } from "./order.js";

export const TIFFIN_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
export const TiffinMealTypeSchema = z.enum(TIFFIN_MEAL_TYPES);
export type TiffinMealType = z.infer<typeof TiffinMealTypeSchema>;

/** "single" = one meal a day, the customer's choice of breakfast, lunch, or dinner (see
 * `CreateTiffinSubscriptionRequestSchema.mealType`). "twice-daily" = lunch and dinner every day,
 * no choice needed. "thrice-daily" = breakfast, lunch, and dinner every day. */
export const TIFFIN_PLAN_STYLES = ["single", "twice-daily", "thrice-daily"] as const;
export const TiffinPlanStyleSchema = z.enum(TIFFIN_PLAN_STYLES);
export type TiffinPlanStyle = z.infer<typeof TiffinPlanStyleSchema>;

export const TiffinDietTypeSchema = z.enum(["veg", "non-veg"]);
export type TiffinDietType = z.infer<typeof TiffinDietTypeSchema>;

/** Days the non-veg plan swaps in a meat curry instead of that day's veg sabzi. Every other
 * weekday (Tue/Thu/Sat) falls back to that day's veg dish (see `TIFFIN_REGULAR_VEG_MENU`). */
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
  /** Thumbnail shown on the plan card — same veg/non-veg tiffin photo shared across every plan
   * of that diet, not a per-plan photo (there's no per-plan dish to photograph). */
  imageUrl: z.string().optional(),
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
  imageUrl: z.string().optional(),
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
 * `mealType` is required only for a "single" style plan (the customer's breakfast/lunch/dinner
 * choice) — "twice-daily"/"thrice-daily" plans ignore it and always schedule their fixed set. */
export const CreateTiffinSubscriptionRequestSchema = z.object({
  planId: z.string(),
  mealType: TiffinMealTypeSchema.optional(),
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
  /** What was actually subscribed — one element for a "single" plan, all three for "thrice-daily". */
  mealTypes: z.array(TiffinMealTypeSchema).min(1),
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

// --- Single-meal purchase (a one-off tiffin, no subscription) ---

/** Three tiers of the one-off single-meal purchase — entirely separate from the subscription
 * catalog above, which stays Regular-only and untiered. */
export const TIFFIN_MEAL_TIERS = ["regular", "mini", "premium"] as const;
export const TiffinMealTierSchema = z.enum(TIFFIN_MEAL_TIERS);
export type TiffinMealTier = z.infer<typeof TiffinMealTierSchema>;

/** Same values as `TiffinMealTypeSchema` but kept as its own named schema — single-meal
 * purchases and subscriptions are unrelated features with independent lifecycles, so a change to
 * one's meal-type handling shouldn't have to consider the other. */
export const SINGLE_MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const;
export const SingleMealTypeSchema = z.enum(SINGLE_MEAL_TYPES);
export type SingleMealType = z.infer<typeof SingleMealTypeSchema>;

/** Only meaningful for the Mini tier — Regular includes both rice and roti, Premium substitutes
 * paratha for roti (also included alongside rice), only Mini serves a single carb of the
 * customer's choice. */
export const TIFFIN_CARB_CHOICES = ["rice", "roti"] as const;
export const TiffinCarbChoiceSchema = z.enum(TIFFIN_CARB_CHOICES);
export type TiffinCarbChoice = z.infer<typeof TiffinCarbChoiceSchema>;

export interface TiffinDailyMenu {
  breakfast: string;
  lunch: string;
  dinner: string;
}

/** Curated from the business's real Regular Tiffin weekly menu (veg) — roti + rice + daal + sabzi,
 * a distinct dish for breakfast/lunch/dinner each day. Mini reuses this table's lunch/dinner
 * dishes (same sabzi, just one carb) — it has no separate menu of its own. */
export const TIFFIN_REGULAR_VEG_MENU: Record<string, TiffinDailyMenu> = {
  Monday: { breakfast: "Masala Pasta", lunch: "Aloo Matar", dinner: "Aloo Gobhi" },
  Tuesday: { breakfast: "Sandwich", lunch: "Aloo Parwal", dinner: "Lauki Masala" },
  Wednesday: { breakfast: "Upma", lunch: "Aloo Soyabean", dinner: "Matar Paneer" },
  Thursday: { breakfast: "Aloo Paratha with Curd & Achar", lunch: "Mushroom Masala", dinner: "Dum Aloo" },
  Friday: { breakfast: "Poha", lunch: "Rajma", dinner: "Matar Chole" },
  Saturday: { breakfast: "Sattu Paratha with Curd & Achar", lunch: "Aloo Gobhi", dinner: "Matar Mushroom" },
  Sunday: { breakfast: "Puri with Chole & Achar", lunch: "Lauki Masala", dinner: "Dum Aloo" },
};

/** Curated from the business's real Premium Tiffin weekly menu (veg) — same daily sabzi as
 * Regular, served with paratha + daal fry instead of roti + daal, plus an upgraded Sunday. */
export const TIFFIN_PREMIUM_VEG_MENU: Record<string, TiffinDailyMenu> = {
  Monday: { breakfast: "Masala Pasta", lunch: "Aloo Matar", dinner: "Aloo Gobhi" },
  Tuesday: { breakfast: "Sandwich", lunch: "Aloo Parwal", dinner: "Lauki Masala" },
  Wednesday: { breakfast: "Upma", lunch: "Aloo Soyabean", dinner: "Matar Paneer" },
  Thursday: { breakfast: "Aloo Paratha with Curd & Achar", lunch: "Mushroom Masala", dinner: "Dum Aloo" },
  Friday: { breakfast: "Poha", lunch: "Rajma", dinner: "Matar Chole" },
  Saturday: { breakfast: "Sattu Paratha with Curd & Achar", lunch: "Aloo Gobhi", dinner: "Matar Mushroom" },
  Sunday: { breakfast: "Idli / Dosa with Sambar & Chutney", lunch: "Paneer Butter Masala with Pulao", dinner: "Puri with Chole" },
};

/** Non-veg keeps the old Bread Omelette on Wednesday breakfast instead of veg's Upma — the one
 * breakfast day where non-veg still diverges from veg; every other breakfast day stays shared. */
export const TIFFIN_NONVEG_BREAKFAST_OVERRIDES: Record<string, string> = {
  Wednesday: "Bread Omelette",
};

/** Single-meal non-veg curation — Regular/Premium swap in a meat curry at dinner on these days
 * (both tiers share the same table); every other day/meal falls back to that tier's veg dish. */
export const TIFFIN_REGULAR_NONVEG_DINNER_OVERRIDES: Record<string, string> = {
  Monday: "Fish Curry",
  Wednesday: "Egg Curry",
  Friday: "Chicken Curry",
};
/** Premium's one extra non-veg upgrade beyond Regular's dinner swaps — Mutton at Sunday lunch. */
export const TIFFIN_PREMIUM_NONVEG_LUNCH_OVERRIDES: Record<string, string> = {
  Sunday: "Mutton Curry",
};
/** Mini deliberately has fewer non-veg days than Regular/Premium — just these two, both dinner. */
export const TIFFIN_MINI_NONVEG_DINNER_OVERRIDES: Record<string, string> = {
  Friday: "Egg Curry",
  Sunday: "Chicken Curry",
};

/** Admin-configurable price per (tier, mealType) — never hardcoded, same convention as
 * `TiffinPlanSchema.price`. Not every combo need exist (e.g. Mini has no breakfast row). */
export const TiffinMealPriceSchema = z.object({
  id: z.string(),
  tier: TiffinMealTierSchema,
  mealType: SingleMealTypeSchema,
  price: z.number().positive(),
  active: z.boolean(),
});
export type TiffinMealPrice = z.infer<typeof TiffinMealPriceSchema>;

export const CreateTiffinMealPriceRequestSchema = z.object({
  tier: TiffinMealTierSchema,
  mealType: SingleMealTypeSchema,
  price: z.number().positive(),
  active: z.boolean().default(true),
});
export type CreateTiffinMealPriceRequest = z.infer<typeof CreateTiffinMealPriceRequestSchema>;

export const UpdateTiffinMealPriceRequestSchema = CreateTiffinMealPriceRequestSchema.partial();
export type UpdateTiffinMealPriceRequest = z.infer<typeof UpdateTiffinMealPriceRequestSchema>;

/** What "tomorrow's menu" returns — two rows (veg + non-veg) per active (tier, mealType) price.
 * Price is shared across diets — only the dish differs. */
export const SingleMealMenuItemSchema = z.object({
  tier: TiffinMealTierSchema,
  mealType: SingleMealTypeSchema,
  dietType: TiffinDietTypeSchema,
  date: z.string(),
  dishName: z.string(),
  price: z.number().positive(),
  carbChoiceRequired: z.boolean(),
  /** Real dish photography, added incrementally as photos become available — most dishes don't
   * have one yet, so this is optional rather than every menu item needing a placeholder. */
  imageUrl: z.string().optional(),
});
export type SingleMealMenuItem = z.infer<typeof SingleMealMenuItemSchema>;

export const CreateSingleMealOrderRequestSchema = z.object({
  tier: TiffinMealTierSchema,
  mealType: SingleMealTypeSchema,
  dietType: TiffinDietTypeSchema,
  carbChoice: TiffinCarbChoiceSchema.optional(),
  delivery: DeliveryDetailsSchema,
  paymentMethod: PaymentMethodSchema,
});
export type CreateSingleMealOrderRequest = z.infer<typeof CreateSingleMealOrderRequestSchema>;

export const TiffinSingleMealOrderStatusSchema = z.enum(["placed", "preparing", "out-for-delivery", "delivered", "cancelled"]);
export type TiffinSingleMealOrderStatus = z.infer<typeof TiffinSingleMealOrderStatusSchema>;

/** Full persisted/returned single-meal order shape. */
export const TiffinSingleMealOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  userId: z.string(),
  tier: TiffinMealTierSchema,
  mealType: SingleMealTypeSchema,
  dietType: TiffinDietTypeSchema,
  carbChoice: TiffinCarbChoiceSchema.optional(),
  /** ISO calendar date (yyyy-mm-dd) — the one day this meal is delivered, always tomorrow at order time. */
  date: z.string(),
  /** Snapshotted at order time — a later menu/price edit shouldn't retroactively rewrite what was ordered. */
  dishName: z.string(),
  status: TiffinSingleMealOrderStatusSchema,
  delivery: DeliveryDetailsSchema,
  price: z.number().positive(),
  payment: TiffinPaymentInfoSchema,
  createdAt: z.string(),
});
export type TiffinSingleMealOrder = z.infer<typeof TiffinSingleMealOrderSchema>;
