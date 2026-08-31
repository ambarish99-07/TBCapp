import { Router } from "express";
import { getStoreStatusPublic } from "./storeSettings.controller.js";

/** Public (no auth) — read by the mobile app before checkout, and before a customer is
 * necessarily logged in, to show the Home screen's closed banner and gate the order button. */
export function createStoreSettingsRouter(): Router {
  const router = Router();
  router.get("/status", getStoreStatusPublic);
  return router;
}
