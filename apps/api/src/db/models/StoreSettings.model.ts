import { Schema, model, type InferSchemaType } from "mongoose";

/** Singleton document (fixed _id) holding the store's manual open/closed switch and its
 * service-hours schedule for catalog-brand ordering — see the shared `StoreSettings` type for the
 * full semantics. There is exactly one of these; getOrCreateStoreSettings() in storeSettings.service.ts
 * creates it with defaults on first read if it doesn't exist yet. */
const StoreSettingsSchema = new Schema(
  {
    _id: { type: String },
    manuallyOpen: { type: Boolean, required: true, default: true },
    enforceServiceHours: { type: Boolean, required: true, default: true },
    openHour: { type: Number, required: true, default: 12, min: 0, max: 23 },
    closeHour: { type: Number, required: true, default: 24, min: 1, max: 24 },
  },
  { timestamps: true, _id: false }
);

export const STORE_SETTINGS_SINGLETON_ID = "store-settings";

export type StoreSettingsDocument = InferSchemaType<typeof StoreSettingsSchema>;
export const StoreSettingsModel = model("StoreSettings", StoreSettingsSchema);
