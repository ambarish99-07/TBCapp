import { DeclareBrandStoreClosureRequestSchema, UpdateStoreSettingsRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import {
  declareBrandStoreClosure,
  getBrandStoreStatus,
  listBrandStoreClosures,
  updateBrandStoreSettings,
} from "./brandStoreSettings.service.js";

/** Public — no auth — the mobile app calls this for whichever brand it's currently showing (the
 * selected Home brand, or the cart's own brand), the same way /store/status covers the
 * Lickyeat-wide switch. Already factors in that parent switch — see getBrandStoreStatus. */
export const getBrandStoreStatusPublic: RequestHandler = async (req, res) => {
  const status = await getBrandStoreStatus(req.params.brandId);
  res.json(status);
};

export const getBrandStoreSettingsAdmin: RequestHandler = async (req, res) => {
  const status = await getBrandStoreStatus(req.params.brandId);
  res.json(status);
};

export const putBrandStoreSettingsAdmin: RequestHandler = async (req, res) => {
  const parsed = UpdateStoreSettingsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid store settings payload", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.openHour != null && parsed.data.closeHour != null && parsed.data.openHour === parsed.data.closeHour) {
    res.status(400).json({ error: "Open and close hour can't be the same — that would mean never open" });
    return;
  }
  await updateBrandStoreSettings(req.params.brandId, parsed.data);
  const status = await getBrandStoreStatus(req.params.brandId);
  res.json(status);
};

export const listBrandStoreClosuresAdmin: RequestHandler = async (req, res) => {
  const closures = await listBrandStoreClosures(req.params.brandId);
  res.json({ closures });
};

export const declareBrandStoreClosureAdmin: RequestHandler = async (req, res) => {
  const parsed = DeclareBrandStoreClosureRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid closure payload", details: parsed.error.flatten() });
    return;
  }
  const closure = await declareBrandStoreClosure(req.params.brandId, parsed.data);
  const status = await getBrandStoreStatus(req.params.brandId);
  res.status(201).json({ closure, status });
};
