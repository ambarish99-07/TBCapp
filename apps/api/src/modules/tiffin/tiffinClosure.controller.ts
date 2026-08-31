import { DeclareTiffinClosureRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import { TiffinClosureModel } from "../../db/models/TiffinClosure.model.js";
import { declareClosure, listClosures } from "./tiffinClosure.service.js";
import { todayIsoInIst } from "../../utils/istDate.js";

export const listClosuresAdmin: RequestHandler = async (_req, res) => {
  const closures = await listClosures();
  res.json({ closures });
};

export const declareClosureAdmin: RequestHandler = async (req, res) => {
  const parsed = DeclareTiffinClosureRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid closure payload", details: parsed.error.flatten() });
    return;
  }
  const result = await declareClosure(parsed.data);
  res.status(201).json(result);
};

/** Public (no auth) — read by the mobile app's GG Tiffin screens to show a "closed" banner, same
 * spirit as /store/status for the catalog brands. Only ever-so-slightly upcoming/ongoing closures
 * matter here — one that's entirely in the past is irrelevant to a customer looking at the app today. */
export const getUpcomingClosuresPublic: RequestHandler = async (_req, res) => {
  const today = todayIsoInIst();
  const closures = await TiffinClosureModel.find({ endDate: { $gte: today } }).sort({ startDate: 1 });
  res.json({ closures });
};
