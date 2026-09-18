import type { Env } from "../../config/env.js";
import { createImageUploadHandlers } from "../../utils/imageUpload.js";

// Mirrors modules/brands/upload.ts and modules/tiffin/upload.ts exactly, just a different
// target folder for menu item photos. Served at /menu-images when using local disk — see
// app.ts's PUBLIC_DIR — or from the configured GCS bucket otherwise.
export function createMenuImageUploadHandlers(env: Env) {
  return createImageUploadHandlers(env, "menu-images");
}
