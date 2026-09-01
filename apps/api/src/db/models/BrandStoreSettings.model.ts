import { Schema, model, type InferSchemaType } from "mongoose";

/** Same shape as StoreSettings (the Lickyeat-wide singleton), but one document per brand — keyed
 * by brandId itself as _id, same convention Brand/MenuItem/Combo already use for human-readable
 * ids. getOrCreateBrandStoreSettings() in brandStoreSettings.service.ts creates one with defaults
 * (open, 12:00-24:00 IST) the first time anything reads or writes a given brandId's settings, so
 * a brand-new brand needs no setup step here — it just works the moment it exists. */
const BrandStoreSettingsSchema = new Schema(
  {
    _id: { type: String },
    manuallyOpen: { type: Boolean, required: true, default: true },
    enforceServiceHours: { type: Boolean, required: true, default: true },
    openHour: { type: Number, required: true, default: 12, min: 0, max: 23 },
    closeHour: { type: Number, required: true, default: 24, min: 1, max: 24 },
  },
  { timestamps: true, _id: false }
);

export type BrandStoreSettingsDocument = InferSchemaType<typeof BrandStoreSettingsSchema>;
export const BrandStoreSettingsModel = model("BrandStoreSettings", BrandStoreSettingsSchema);
