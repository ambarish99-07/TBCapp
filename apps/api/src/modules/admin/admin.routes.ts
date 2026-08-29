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
import {
  createMealPriceAdmin,
  listMealPricesAdmin,
  listTodaysSingleMealOrdersAdmin,
  updateMealPriceAdmin,
  updateSingleMealOrderStatusAdmin,
} from "../tiffin/singleMeal.controller.js";
import { listFeedbackAdmin, respondToFeedbackAdmin, updateFeedbackStatusAdmin } from "../feedback/feedback.controller.js";
import { advanceOrderStatus, getAnalytics, listOrders, recommendToCustomer } from "./admin.controller.js";

export function createAdminRouter(env: Env): Router {
  const router = Router();
  router.use(requireAuth(env.JWT_SECRET), requireAdmin);

  router.get("/analytics", getAnalytics);

  router.get("/feedback", listFeedbackAdmin);
  router.patch("/feedback/:id/status", updateFeedbackStatusAdmin);
  router.patch("/feedback/:id/respond", respondToFeedbackAdmin);

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

  router.get("/tiffin/single-meal/orders/today", listTodaysSingleMealOrdersAdmin);
  router.patch("/tiffin/single-meal/orders/:id/status", updateSingleMealOrderStatusAdmin);
  router.get("/tiffin/meal-prices", listMealPricesAdmin);
  router.post("/tiffin/meal-prices", createMealPriceAdmin);
  router.put("/tiffin/meal-prices/:id", updateMealPriceAdmin);

  return router;
}
