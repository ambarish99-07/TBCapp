import type { Env } from "../../config/env.js";
import { createImageUploadHandlers } from "../../utils/imageUpload.js";

// Mirrors modules/menu/upload.ts and modules/tiffin/upload.ts exactly, just a different
// target folder for brand logos/hero photos. Served at /brand-images when using local disk —
// see app.ts's PUBLIC_DIR — or from the configured GCS bucket otherwise.
export function createBrandImageUploadHandlers(env: Env) {
  return createImageUploadHandlers(env, "brand-images");
}
