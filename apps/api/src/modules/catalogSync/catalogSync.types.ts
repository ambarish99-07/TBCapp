import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Catalog sync between this app's API and the Lickyeat website's API — two separate databases
 * that sell the same kitchens' food. Whenever an admin changes the catalog on either side, that
 * side sends the change to the other as one of these events, signed with a shared secret
 * (CATALOG_SYNC_SECRET). The receiving side applies it straight to its own models and does NOT
 * re-send it, so nothing loops.
 *
 * The wire format is "canonical": the website's field names and brand ids (lowercase slugs). This
 * side translates on the way in and out (see catalogSync.service.ts) — e.g. the app's historic
 * "TBL" brand id is "the-biryani-lane" on the wire. The exact same file exists in both repos
 * (apps/api/src/modules/catalogSync/catalogSync.types.ts) — keep the two identical.
 */

export const CanonicalBrandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().nullable().optional(),
  status: z.enum(["live", "coming-soon"]),
  logoUrl: z.string().nullable().optional(),
  heroImageUrl: z.string().nullable().optional(),
  heroImageUrlDark: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  displayOrder: z.number().nullable().optional(),
});
export type CanonicalBrand = z.infer<typeof CanonicalBrandSchema>;

export const CanonicalMenuItemSchema = z.object({
  id: z.string().min(1),
  brandId: z.string().min(1),
  signatureName: z.string().min(1),
  commonName: z.string(),
  description: z.string(),
  price: z.number().nonnegative(),
  category: z.string().min(1),
  /** Absolute URL, or a path relative to the SENDER's public API base (resolved by the receiver). */
  imageUrl: z.string().nullable(),
  dietType: z.enum(["veg", "non-veg"]),
  flavorBadges: z.array(z.string()),
  isPopular: z.boolean(),
  isNew: z.boolean(),
  isStaffPick: z.boolean(),
  isAvailable: z.boolean(),
  pairsWith: z.array(z.string()),
  salePercent: z.number().min(1).max(99).nullable(),
  portionSize: z.string().nullable(),
  sizeVariants: z.array(z.object({ label: z.string(), price: z.number().nonnegative(), isAvailable: z.boolean() })),
  hasSugarIceCustomization: z.boolean(),
  addOnNames: z.array(z.string()),
});
export type CanonicalMenuItem = z.infer<typeof CanonicalMenuItemSchema>;

export const CanonicalAddOnSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  isAvailable: z.boolean(),
});
export type CanonicalAddOn = z.infer<typeof CanonicalAddOnSchema>;

export const CanonicalComboSchema = z.object({
  id: z.string().min(1),
  /** A kitchen's brand id, or "feast" for a multi-kitchen Feast combo. */
  brandId: z.string().min(1),
  type: z.enum(["curated", "choose-n"]),
  name: z.string().min(1),
  description: z.string(),
  imageUrl: z.string().nullable(),
  itemIds: z.array(z.string()),
  chooseCount: z.number().int().positive().nullable(),
  eligibleItemIds: z.array(z.string()),
  discountPercent: z.number().min(1).max(99).nullable(),
  feastSize: z.enum(["one", "two", "four", "party"]).nullable(),
});
export type CanonicalCombo = z.infer<typeof CanonicalComboSchema>;

/** The manual "accepting orders" switch — "lickyeat" (everything) or one kitchen's brand id.
 * Opening hours and planned closures are modelled differently on each side and aren't synced. */
export const CanonicalStoreSwitchSchema = z.object({
  scope: z.string().min(1),
  open: z.boolean(),
});
export type CanonicalStoreSwitch = z.infer<typeof CanonicalStoreSwitchSchema>;

export const CatalogEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("brand.upsert"), data: CanonicalBrandSchema }),
  z.object({ kind: z.literal("brand.delete"), id: z.string().min(1) }),
  z.object({ kind: z.literal("menuItem.upsert"), data: CanonicalMenuItemSchema }),
  z.object({ kind: z.literal("menuItem.delete"), id: z.string().min(1) }),
  z.object({ kind: z.literal("addOn.upsert"), data: CanonicalAddOnSchema }),
  z.object({ kind: z.literal("addOn.delete"), name: z.string().min(1) }),
  z.object({ kind: z.literal("combo.upsert"), data: CanonicalComboSchema }),
  z.object({ kind: z.literal("combo.delete"), id: z.string().min(1) }),
  z.object({ kind: z.literal("storeSwitch.upsert"), data: CanonicalStoreSwitchSchema }),
]);
export type CatalogEvent = z.infer<typeof CatalogEventSchema>;

export const CatalogSyncRequestSchema = z.object({
  events: z.array(CatalogEventSchema).max(100),
});

/** What each side can report about itself, so a full push can show what exists only on the peer. */
export interface CatalogSnapshot {
  brandIds: string[];
  menuItemIds: string[];
  comboIds: string[];
  addOnNames: string[];
}

export const SYNC_TIMESTAMP_HEADER = "x-lickyeat-sync-ts";
export const SYNC_SIGNATURE_HEADER = "x-lickyeat-sync-signature";
/** A signed request older (or newer) than this is refused — limits replaying a captured request. */
export const SYNC_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function signSyncBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifySyncSignature(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  body: string,
  now = Date.now()
): boolean {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SYNC_MAX_CLOCK_SKEW_MS) return false;
  const expected = Buffer.from(signSyncBody(secret, timestamp, body), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
