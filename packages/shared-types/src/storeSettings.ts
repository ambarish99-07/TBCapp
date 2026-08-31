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
export const StoreClosedReasonSchema = z.enum(["manually-closed", "outside-hours"]);
export type StoreClosedReason = z.infer<typeof StoreClosedReasonSchema>;

export const StoreStatusSchema = z.object({
  isOpen: z.boolean(),
  reason: StoreClosedReasonSchema.optional(),
  settings: StoreSettingsSchema,
});
export type StoreStatus = z.infer<typeof StoreStatusSchema>;
