import { Router } from "express";
import type { Env } from "../../config/env.js";
import { listBulkOrderInquiries, updateBulkOrderInquiryStatus } from "../bulkOrders/bulkOrders.controller.js";
import { createBrand, deleteBrand, listAllBrandsAdmin, updateBrand } from "../brands/brands.controller.js";
import { requireAdmin, requireAuth } from "../auth/auth.middleware.js";
import {
  createPlanAdmin,
  listAllPlansAdmin,
  listAllSubscriptionsAdmin,
  listTodaysScheduledMealsAdmin,
  updatePlanAdmin,
  updateScheduledMealStatusAdmin,
} from "../tiffin/tiffin.controller.js";
import { advanceOrderStatus, listOrders, recommendToCustomer } from "./admin.controller.js";

export function createAdminRouter(env: Env): Router {
  const router = Router();
  router.use(requireAuth(env.JWT_SECRET), requireAdmin);

  router.get("/orders", listOrders);
  router.patch("/orders/:id/status", advanceOrderStatus);
  router.post("/orders/:id/recommend", recommendToCustomer(env));

  router.get("/bulk-order-inquiries", listBulkOrderInquiries);
  router.patch("/bulk-order-inquiries/:id/status", updateBulkOrderInquiryStatus);

  router.get("/brands", listAllBrandsAdmin);
  router.post("/brands", createBrand);
  router.put("/brands/:id", updateBrand);
  router.delete("/brands/:id", deleteBrand);

  router.get("/tiffin/plans", listAllPlansAdmin);
  router.post("/tiffin/plans", createPlanAdmin);
  router.put("/tiffin/plans/:id", updatePlanAdmin);
  router.get("/tiffin/subscriptions", listAllSubscriptionsAdmin);
  router.get("/tiffin/deliveries/today", listTodaysScheduledMealsAdmin);
  router.patch("/tiffin/meals/:id/status", updateScheduledMealStatusAdmin);

  return router;
}
