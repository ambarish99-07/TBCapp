import type { Env } from "../../config/env.js";
import { createImageUploadHandlers } from "../../utils/imageUpload.js";

// Mirrors modules/menu/upload.ts and modules/brands/upload.ts exactly, just a different
// target folder for tiffin dish photos. Served at /tiffin-images when using local disk — see
// app.ts's PUBLIC_DIR — or from the configured GCS bucket otherwise.
export function createTiffinImageUploadHandlers(env: Env) {
  return createImageUploadHandlers(env, "tiffin-images");
}
