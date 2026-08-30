import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import type { RequestHandler } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same folder app.ts serves at /menu-images — see PUBLIC_DIR there. Lives as a sibling of both
// src/ (dev, via tsx) and dist/ (production build), same as the rest of public/.
const MENU_IMAGES_DIR = path.join(__dirname, "../../../public/menu-images");

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MENU_IMAGES_DIR),
  // Random filename, not the client-supplied one — avoids path traversal and name collisions
  // between two different admins uploading a photo around the same time.
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED_MIME_TYPES[file.mimetype] ?? ""}`),
});

export const uploadMenuItemImage: RequestHandler = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new Error("Only PNG, JPEG, or WEBP images are allowed"));
      return;
    }
    cb(null, true);
  },
}).single("image");

/** Handed a file already saved to MENU_IMAGES_DIR by the multer middleware above — builds the
 * same kind of absolute URL app.ts's static handler serves it back at, from the request itself
 * rather than a hardcoded host, so this also works once the API isn't on localhost anymore. */
export const handleMenuItemImageUpload: RequestHandler = (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image file was uploaded" });
    return;
  }
  const url = `${req.protocol}://${req.get("host")}/menu-images/${req.file.filename}`;
  res.status(201).json({ url });
};
