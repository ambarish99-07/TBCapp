import { z } from "zod";

/** Only "live" brands are ever shown in the customer app's brand picker. */
export const BrandStatusSchema = z.enum(["live", "coming-soon"]);
export type BrandStatus = z.infer<typeof BrandStatusSchema>;

/** A storefront under the Lickyeat umbrella (e.g. "The Blenders Club"). `id` is the slug itself, e.g. "tbc". */
export const BrandSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  /** Wide lifestyle/product photo for the big carousel hero — falls back to logoUrl if unset. */
  heroImageUrl: z.string().optional(),
  /** Optional dark-mode variant of the hero photo (e.g. a moodier/night-lit shot) — falls back to
   * heroImageUrl (then logoUrl) when unset, so setting this is never required. */
  heroImageUrlDark: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  status: BrandStatusSchema,
  /** Where this brand sits in the Home carousel and every other brand list — ascending, ties
   * broken by createdAt. Optional on input; createBrand always fills it in (append-to-end) so a
   * brand can never end up unset in storage, which matters because MongoDB sorts a *missing*
   * field as lower than any number, and an unset brand jumping to the front would be worse than
   * just defaulting it. */
  displayOrder: z.number().optional(),
  createdAt: z.string(),
});
export type Brand = z.infer<typeof BrandSchema>;

export const CreateBrandRequestSchema = BrandSchema.omit({ createdAt: true });
export type CreateBrandRequest = z.infer<typeof CreateBrandRequestSchema>;

export const UpdateBrandRequestSchema = CreateBrandRequestSchema.omit({ id: true }).partial();
export type UpdateBrandRequest = z.infer<typeof UpdateBrandRequestSchema>;

/** Sentinel combo brandId for the one combo not owned by any single brand — its eligible items span every live brand. Never a real Brand doc. */
export const CROSS_BRAND_ID = "cross-brand";
