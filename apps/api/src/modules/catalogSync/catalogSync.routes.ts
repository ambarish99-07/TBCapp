import { Router, type Request, type RequestHandler } from "express";
import { z } from "zod";
import {
  applyCatalogEvent,
  catalogDiff,
  catalogSyncConfigured,
  getCatalogSyncSecret,
  localSnapshot,
  pushFullCatalog,
} from "./catalogSync.service.js";
import {
  CatalogSyncRequestSchema,
  SYNC_SIGNATURE_HEADER,
  SYNC_TIMESTAMP_HEADER,
  verifySyncSignature,
} from "./catalogSync.types.js";

/** Only the website's API, holding the shared CATALOG_SYNC_SECRET, can call these. The signature
 * covers the exact raw request bytes (captured by express.json's `verify` hook in app.ts). */
const requireSyncSignature: RequestHandler = (req, res, next) => {
  const secret = getCatalogSyncSecret();
  if (!secret) {
    res.status(503).json({ error: "Catalog sync is not configured on this server" });
    return;
  }
  const raw = (req as Request & { rawBody?: string }).rawBody ?? "";
  if (!verifySyncSignature(secret, req.header(SYNC_TIMESTAMP_HEADER), req.header(SYNC_SIGNATURE_HEADER), raw)) {
    res.status(401).json({ error: "Invalid or expired sync signature" });
    return;
  }
  next();
};

/** Mounted at /internal/catalog-sync. */
export function createCatalogSyncInternalRouter(): Router {
  const router = Router();

  router.post("/", requireSyncSignature, async (req, res) => {
    const parsed = CatalogSyncRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid sync payload", details: parsed.error.flatten() });
      return;
    }
    for (const event of parsed.data.events) await applyCatalogEvent(event);
    res.json({ applied: parsed.data.events.length });
  });

  router.post("/snapshot", requireSyncSignature, async (_req, res) => {
    res.json(await localSnapshot());
  });

  return router;
}

/** Admin-only (mounted inside the admin router): status + what differs, and the full push. */
export const getCatalogSyncStatusAdmin: RequestHandler = async (_req, res) => {
  if (!catalogSyncConfigured()) {
    res.json({ configured: false });
    return;
  }
  try {
    res.json({ configured: true, reachable: true, diff: await catalogDiff() });
  } catch (err) {
    res.json({ configured: true, reachable: false, error: err instanceof Error ? err.message : "Website unreachable" });
  }
};

export const postCatalogSyncPushAdmin: RequestHandler = async (req, res) => {
  if (!catalogSyncConfigured()) {
    res.status(400).json({ error: "Website sync isn't set up on this server yet" });
    return;
  }
  const { removeWebsiteOnly } = z.object({ removeWebsiteOnly: z.boolean().default(false) }).parse(req.body ?? {});
  try {
    res.json(await pushFullCatalog({ removeWebsiteOnly }));
  } catch (err) {
    res.status(502).json({ error: `Couldn't reach the website: ${err instanceof Error ? err.message : "unknown error"}` });
  }
};
