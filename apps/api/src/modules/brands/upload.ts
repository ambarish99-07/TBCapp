import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import type { RequestHandler } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same folder app.ts serves at /brand-images — see PUBLIC_DIR there. Mirrors modules/menu/upload.ts
// and modules/tiffin/upload.ts exactly, just a different target folder for brand logos/hero photos.
const BRAND_IMAGES_DIR = path.join(__dirname, "../../../public/brand-images");

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BRAND_IMAGES_DIR),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED_MIME_TYPES[file.mimetype] ?? ""}`),
});

export const uploadBrandImage: RequestHandler = multer({
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

export const handleBrandImageUpload: RequestHandler = (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image file was uploaded" });
    return;
  }
  const url = `${req.protocol}://${req.get("host")}/brand-images/${req.file.filename}`;
  res.status(201).json({ url });
};
