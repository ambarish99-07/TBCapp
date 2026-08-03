import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAdmin, requireAuth } from "../auth/auth.middleware.js";
import { advanceOrderStatus, listOrders, recommendToCustomer } from "./admin.controller.js";

export function createAdminRouter(env: Env): Router {
  const router = Router();
  router.use(requireAuth(env.JWT_SECRET), requireAdmin);

  router.get("/orders", listOrders);
  router.patch("/orders/:id/status", advanceOrderStatus);
  router.post("/orders/:id/recommend", recommendToCustomer(env));

  return router;
}
