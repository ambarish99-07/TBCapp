import { Router } from "express";
import type { Env } from "../../config/env.js";
import { listBulkOrderInquiries, updateBulkOrderInquiryStatus } from "../bulkOrders/bulkOrders.controller.js";
import { requireAdmin, requireAuth } from "../auth/auth.middleware.js";
import { advanceOrderStatus, listOrders, recommendToCustomer } from "./admin.controller.js";

export function createAdminRouter(env: Env): Router {
  const router = Router();
  router.use(requireAuth(env.JWT_SECRET), requireAdmin);

  router.get("/orders", listOrders);
  router.patch("/orders/:id/status", advanceOrderStatus);
  router.post("/orders/:id/recommend", recommendToCustomer(env));

  router.get("/bulk-order-inquiries", listBulkOrderInquiries);
  router.patch("/bulk-order-inquiries/:id/status", updateBulkOrderInquiryStatus);

  return router;
}
