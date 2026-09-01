import { z } from "zod";

/**
 * Store-wide ordering availability for catalog brands (TBC, TAT, and any future brand ordered
 * through the cart/checkout flow) — deliberately does NOT cover GG Tiffin, which has its own
 * separate per-meal cutoff system (see apps/api/src/modules/tiffin/mealOrderingWindow.ts).
 *
 * Two independent controls, both admin-editable:
 * - `manuallyOpen`: an immediate kill switch — e.g. no staff available right now — that overrides
 *   everything else the instant it's flipped off, regardless of the scheduled hours below.
 * - `enforceServiceHours` + `openHour`/`closeHour`: an optional daily schedule (IST, 0-23 for
 *   `openHour`, 1-24 for `closeHour`; `closeHour <= openHour` means the window crosses midnight,
 *   e.g. open 18 close 2 = 6pm-2am). When `enforceServiceHours` is off, only the manual switch
 *   matters and the store is orderable around the clock.
 */
export const StoreSettingsSchema = z.object({
  manuallyOpen: z.boolean(),
  enforceServiceHours: z.boolean(),
  openHour: z.number().int().min(0).max(23),
  closeHour: z.number().int().min(1).max(24),
});
export type StoreSettings = z.infer<typeof StoreSettingsSchema>;

export const UpdateStoreSettingsRequestSchema = StoreSettingsSchema.partial();
export type UpdateStoreSettingsRequest = z.infer<typeof UpdateStoreSettingsRequestSchema>;

/** Why the store is (or isn't) currently accepting catalog orders — surfaced to the customer so
 * the closed message is specific rather than generic. */
export const StoreClosedReasonSchema = z.enum(["manually-closed", "outside-hours", "planned-closure"]);
export type StoreClosedReason = z.infer<typeof StoreClosedReasonSchema>;

/**
 * An admin-declared "closed on these dates" window for catalog-brand ordering — a holiday,
 * planned maintenance, etc., known ahead of time rather than a sudden emergency. Announced to
 * customers in advance (see StoreStatus.upcomingClosures below), not just enforced silently once
 * the date arrives. Unlike GG Tiffin's TiffinClosure, there's no subscription to extend or
 * existing order to auto-cancel here — catalog orders are same-day, never scheduled for a future
 * date, so a planned closure only ever affects ordering that hasn't happened yet.
 */
export const StoreClosureSchema = z.object({
  id: z.string(),
  /** Both ISO calendar dates (yyyy-mm-dd), inclusive. */
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(300).optional(),
  createdAt: z.string(),
});
export type StoreClosure = z.infer<typeof StoreClosureSchema>;

export const DeclareStoreClosureRequestSchema = z
  .object({
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().max(300).optional(),
  })
  .refine((data) => data.startDate <= data.endDate, { message: "End date must be on or after the start date", path: ["endDate"] });
export type DeclareStoreClosureRequest = z.infer<typeof DeclareStoreClosureRequestSchema>;

export const StoreStatusSchema = z.object({
  isOpen: z.boolean(),
  reason: StoreClosedReasonSchema.optional(),
  settings: StoreSettingsSchema,
  /** Populated only when `reason` is "planned-closure" — the specific closure record currently in effect. */
  activeClosure: StoreClosureSchema.optional(),
  /** Every declared closure whose end date hasn't passed yet, soonest first — lets the customer
   * app show a heads-up ("closed Sept 5-8") even before the closure actually starts, not just
   * once ordering is already blocked. */
  upcomingClosures: z.array(StoreClosureSchema),
});
export type StoreStatus = z.infer<typeof StoreStatusSchema>;

// --- Per-brand ordering availability ---

/**
 * The same switch/hours/planned-closures system as StoreSettings above, just scoped to one
 * brand instead of every catalog brand at once — e.g. The Blenders Club can close early on
 * Sundays while The Alchemy Tails stays open. Works alongside the Lickyeat-wide StoreSettings,
 * never instead of it: the parent switch is an absolute override (off there means every brand is
 * closed no matter what its own settings say); a brand's own switch only ever narrows further.
 * Brand-new brands get working defaults (open, 12:00-24:00 IST) automatically the first time
 * anything reads or writes their settings — no setup step required to add one.
 */
export const BrandStoreClosureSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(300).optional(),
  createdAt: z.string(),
});
export type BrandStoreClosure = z.infer<typeof BrandStoreClosureSchema>;

export const DeclareBrandStoreClosureRequestSchema = DeclareStoreClosureRequestSchema;
export type DeclareBrandStoreClosureRequest = z.infer<typeof DeclareBrandStoreClosureRequestSchema>;

export const BrandStoreStatusSchema = z.object({
  brandId: z.string(),
  isOpen: z.boolean(),
  reason: StoreClosedReasonSchema.optional(),
  /** True when the closure came from the Lickyeat-wide switch/hours/closure — an absolute
   * override — rather than this brand's own settings. When true, `settings`/`activeClosure`
   * below describe the PARENT's configuration (whichever one is actually blocking ordering),
   * not this brand's own, so the customer message stays exactly as specific either way; this
   * flag exists purely so an admin looking at one brand's page can tell which level caused it. */
  closedByLickyeat: z.boolean(),
  settings: StoreSettingsSchema,
  activeClosure: z.union([StoreClosureSchema, BrandStoreClosureSchema]).optional(),
  upcomingClosures: z.array(BrandStoreClosureSchema),
});
export type BrandStoreStatus = z.infer<typeof BrandStoreStatusSchema>;
