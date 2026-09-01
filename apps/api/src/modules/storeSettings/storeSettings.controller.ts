import { DeclareStoreClosureRequestSchema, UpdateStoreSettingsRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import { declareStoreClosure, getStoreStatus, listStoreClosures, updateStoreSettings } from "./storeSettings.service.js";

/** Public — no auth — so the mobile app's Home screen banner and checkout guard can both read it
 * before a customer is necessarily logged in. */
export const getStoreStatusPublic: RequestHandler = async (_req, res) => {
  const status = await getStoreStatus();
  res.json(status);
};

export const getStoreSettingsAdmin: RequestHandler = async (_req, res) => {
  const status = await getStoreStatus();
  res.json(status);
};

export const putStoreSettingsAdmin: RequestHandler = async (req, res) => {
  const parsed = UpdateStoreSettingsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid store settings payload", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.openHour != null && parsed.data.closeHour != null && parsed.data.openHour === parsed.data.closeHour) {
    res.status(400).json({ error: "Open and close hour can't be the same — that would mean never open" });
    return;
  }
  await updateStoreSettings(parsed.data);
  const status = await getStoreStatus();
  res.json(status);
};

export const listStoreClosuresAdmin: RequestHandler = async (_req, res) => {
  const closures = await listStoreClosures();
  res.json({ closures });
};

export const declareStoreClosureAdmin: RequestHandler = async (req, res) => {
  const parsed = DeclareStoreClosureRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid closure payload", details: parsed.error.flatten() });
    return;
  }
  const closure = await declareStoreClosure(parsed.data);
  const status = await getStoreStatus();
  res.status(201).json({ closure, status });
};
