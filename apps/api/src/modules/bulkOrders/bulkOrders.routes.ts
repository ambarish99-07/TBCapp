import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { Env } from "../../config/env.js";
import { createBulkOrderInquiry } from "./bulkOrders.controller.js";

// Public endpoint (no login required to ask about a bulk order) — capped to
// stop it being used to spam the shop owner's WhatsApp.
const bulkOrderInquiryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

export function createBulkOrdersRouter(env: Env): Router {
  const router = Router();
  router.post("/", bulkOrderInquiryRateLimiter, createBulkOrderInquiry(env));
  return router;
}
