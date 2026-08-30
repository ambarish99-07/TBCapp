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
  /** A few plans may carry a discount — the charged price is the marked-down one, `price` stays
   * the strikethrough display value. Mirrors MenuItem's salePercent exactly. */
  salePercent: z.number().min(1).max(99).optional(),
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
  salePercent: z.number().min(1).max(99).optional(),
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

/** How many of the same meal a customer can add in one order from the customize pop-up. */
export const MAX_SINGLE_MEAL_QUANTITY = 10;

/** Only meaningful for the Mini tier — Regular includes both rice and roti, Premium substitutes
 * paratha for roti (also included alongside rice), only Mini serves a single carb of the
 * customer's choice. */
export const TIFFIN_CARB_CHOICES = ["rice", "roti"] as const;
export const TiffinCarbChoiceSchema = z.enum(TIFFIN_CARB_CHOICES);
export type TiffinCarbChoice = z.infer<typeof TiffinCarbChoiceSchema>;

export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const DayOfWeekSchema = z.enum(DAYS_OF_WEEK);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

/**
 * One admin-editable slot in GG Tiffin's single-meal weekly rotation — "on {dayOfWeek}, a
 * {dietType} {tier} customer's {mealType} is {dishName}." This is the one source of truth for
 * both the single-meal purchase menu and (via its `tier: "regular"` rows) subscription meal
 * scheduling — replaces what used to be hardcoded weekly-menu tables plus several cascading
 * "override" tables duplicated across the API and mobile app. Not every (tier, mealType)
 * combination has a row — Mini has no breakfast at all.
 */
export const TiffinDishSchema = z.object({
  id: z.string(),
  tier: TiffinMealTierSchema,
  dietType: TiffinDietTypeSchema,
  mealType: SingleMealTypeSchema,
  dayOfWeek: DayOfWeekSchema,
  dishName: z.string().min(1),
  /** Real dish photography — every slot gets one, uploaded from the admin panel. */
  image: z.string().optional(),
  /** False only for a dish that's already a complete two-part meal on its own (e.g. "Puri with
   * Chole") — every other dish offers the usual staples + a top-up as add-ons. */
  hasAddOns: z.boolean().default(true),
  /** Only consulted for the Premium tier's staple list — Regular/Mini always offer plain rice. */
  riceSubstitute: z.enum(["rice", "pulao"]).default("rice"),
  /** This dish's own "extra portion" add-on name (must match a TiffinAddOnPrice row) — e.g.
   * "Chicken piece" for a chicken curry. Unset for a plain veg dish: the add-on is then
   * synthesized as "Extra {dishName}", priced at the shared "Extra Portion" add-on price. */
  extraAddOnName: z.string().optional(),
});
export type TiffinDish = z.infer<typeof TiffinDishSchema>;

export const UpsertTiffinDishRequestSchema = TiffinDishSchema.omit({ id: true });
export type UpsertTiffinDishRequest = z.infer<typeof UpsertTiffinDishRequestSchema>;

/** A named add-on's shared flat price — the same "Rice" costs the same wherever it's offered, so
 * its price lives here once rather than being repeated on every dish that offers it. Also holds
 * the generic "Extra Portion" veg top-up price (see `TiffinDish.extraAddOnName`). */
export const TiffinAddOnPriceSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().positive(),
});
export type TiffinAddOnPrice = z.infer<typeof TiffinAddOnPriceSchema>;

export const UpsertTiffinAddOnPriceRequestSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});
export type UpsertTiffinAddOnPriceRequest = z.infer<typeof UpsertTiffinAddOnPriceRequestSchema>;

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

/** A real, individually-priced extra the customer can choose to add to a meal — never included
 * automatically. */
export const SingleMealAddOnSchema = z.object({
  name: z.string(),
  price: z.number().nonnegative(),
});
export type SingleMealAddOn = z.infer<typeof SingleMealAddOnSchema>;

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
  /** The optional extras offered for this meal (e.g. Rice, Roti, Daal, an extra piece of the
   * protein) — a catalog to choose from in the customize pop-up, not what's included by default.
   * Empty for breakfast and Premium's already-complete Sunday dinner, which have nothing to add. */
  addOns: z.array(SingleMealAddOnSchema),
});
export type SingleMealMenuItem = z.infer<typeof SingleMealMenuItemSchema>;

export const CreateSingleMealOrderRequestSchema = z.object({
  tier: TiffinMealTierSchema,
  mealType: SingleMealTypeSchema,
  dietType: TiffinDietTypeSchema,
  carbChoice: TiffinCarbChoiceSchema.optional(),
  quantity: z.number().int().min(1).max(MAX_SINGLE_MEAL_QUANTITY),
  /** Names of add-ons the customer chose from the catalog — re-priced server-side against the
   * resolved catalog for this meal, never trusted from the client. */
  selectedAddOns: z.array(z.string()).default([]),
  delivery: DeliveryDetailsSchema,
  paymentMethod: PaymentMethodSchema,
});
export type CreateSingleMealOrderRequest = z.infer<typeof CreateSingleMealOrderRequestSchema>;

export const TiffinSingleMealOrderStatusSchema = z.enum(["placed", "preparing", "out-for-delivery", "delivered", "cancelled"]);
export type TiffinSingleMealOrderStatus = z.infer<typeof TiffinSingleMealOrderStatusSchema>;

export const TiffinSingleMealStatusHistoryEntrySchema = z.object({
  status: TiffinSingleMealOrderStatusSchema,
  at: z.string(), // ISO timestamp
});
export type TiffinSingleMealStatusHistoryEntry = z.infer<typeof TiffinSingleMealStatusHistoryEntrySchema>;

/** The rider handling this order — assigned once it moves to "out-for-delivery" (there's no real
 * rider app in this system, so this is picked from a fixed demo pool, not live dispatch). */
export const DeliveryPartnerSchema = z.object({
  name: z.string(),
  phone: z.string(),
});
export type DeliveryPartner = z.infer<typeof DeliveryPartnerSchema>;

/** A single-meal order cancelled within this many minutes of being placed gets a full refund
 * (only meaningful for an already-paid Razorpay order — COD never charged anything upfront);
 * on or after it, no refund. Unlike subscriptions' CANCELLATION_REFUND_PERCENT, this is all-or-
 * nothing — a single meal is a same-day, already-in-motion order, not a multi-week commitment. */
export const SINGLE_MEAL_CANCELLATION_WINDOW_MINUTES = 15;

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
  /** The add-ons the customer actually chose, snapshotted with their price at order time — add to
   * price × quantity for the amount actually charged. */
  addOns: z.array(SingleMealAddOnSchema),
  status: TiffinSingleMealOrderStatusSchema,
  statusHistory: z.array(TiffinSingleMealStatusHistoryEntrySchema),
  deliveryPartner: DeliveryPartnerSchema.optional(),
  delivery: DeliveryDetailsSchema,
  /** Per-unit BASE price (add-ons are priced separately) — multiply by quantity for the meal's
   * share of the total charged. */
  price: z.number().positive(),
  quantity: z.number().int().min(1),
  payment: TiffinPaymentInfoSchema,
  createdAt: z.string(),
});
export type TiffinSingleMealOrder = z.infer<typeof TiffinSingleMealOrderSchema>;
