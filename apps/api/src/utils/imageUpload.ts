import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Sibling of both src/ (dev, via tsx) and dist/ (production build) — see app.ts's PUBLIC_DIR.
const PUBLIC_DIR = path.join(__dirname, "../../public");

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(new Error("Only PNG, JPEG, or WEBP images are allowed"));
    return;
  }
  cb(null, true);
};

// Lazily constructed — instantiating Storage() eagerly would attempt Google Cloud auth on every
// boot, even in local dev where GCS_BUCKET_NAME is unset and no such credentials exist.
let storageClient: Storage | undefined;
function getStorageClient(): Storage {
  storageClient ??= new Storage();
  return storageClient;
}

export interface ImageUploadHandlers {
  /** multer middleware — parses the multipart "image" field, validates type/size. */
  uploadMiddleware: RequestHandler;
  /** Persists the uploaded file (disk or GCS, depending on env) and responds with its URL. */
  handleUpload: RequestHandler;
}

/**
 * Builds upload handlers for one image folder (menu/brand/tiffin dish photos).
 *
 * Storage backend depends on `env.GCS_BUCKET_NAME`:
 * - Set: uploads go to that Cloud Storage bucket (`gs://bucket/<folderName>/<uuid>.<ext>`),
 *   needed on any host with an ephemeral filesystem (Cloud Run, Render, ...) where a locally
 *   written file wouldn't survive a container restart. Relies on Application Default
 *   Credentials — on Cloud Run this is the attached service account, no key file needed. The
 *   bucket must have bucket-level public read access already configured (uniform bucket-level
 *   access + `allUsers` granted `Storage Object Viewer`) — this code never sets an object-level
 *   ACL, since that's rejected on buckets using the modern uniform access mode.
 * - Unset: falls back to the original local-disk behavior, writing into
 *   apps/api/public/<folderName> and serving it via the matching express.static mount in app.ts.
 */
export function createImageUploadHandlers(env: Env, folderName: string): ImageUploadHandlers {
  const bucketName = env.GCS_BUCKET_NAME;

  if (!bucketName) {
    const targetDir = path.join(PUBLIC_DIR, folderName);
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, targetDir),
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED_MIME_TYPES[file.mimetype] ?? ""}`),
    });
    const uploadMiddleware = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter }).single("image");

    const handleUpload: RequestHandler = (req, res) => {
      if (!req.file) {
        res.status(400).json({ error: "No image file was uploaded" });
        return;
      }
      const url = `${req.protocol}://${req.get("host")}/${folderName}/${req.file.filename}`;
      res.status(201).json({ url });
    };

    return { uploadMiddleware, handleUpload };
  }

  const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
  }).single("image");

  const handleUpload: RequestHandler = async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No image file was uploaded" });
      return;
    }
    const objectName = `${folderName}/${crypto.randomUUID()}${ALLOWED_MIME_TYPES[req.file.mimetype] ?? ""}`;
    const bucket = getStorageClient().bucket(bucketName);
    await bucket.file(objectName).save(req.file.buffer, { contentType: req.file.mimetype });
    res.status(201).json({ url: `https://storage.googleapis.com/${bucketName}/${objectName}` });
  };

  return { uploadMiddleware, handleUpload };
}
