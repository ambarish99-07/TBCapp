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
import {
  deleteFestivalSpecialAdmin,
  listAddOnPricesAdmin,
  listFestivalSpecialsAdmin,
  listTiffinDishesAdmin,
  upsertAddOnPriceAdmin,
  upsertFestivalSpecialAdmin,
  upsertTiffinDishAdmin,
} from "../tiffin/tiffinMenu.controller.js";
import { handleTiffinDishImageUpload, uploadTiffinDishImage } from "../tiffin/upload.js";
import { declareClosureAdmin, listClosuresAdmin } from "../tiffin/tiffinClosure.controller.js";
import { createCouponAdmin, deleteCouponAdmin, listCouponsAdmin, updateCouponAdmin } from "../coupons/coupons.controller.js";
import {
  advanceOrderStatus,
  getAnalytics,
  getCustomerAdmin,
  listCustomerRecommendationsAdmin,
  listCustomersAdmin,
  listOrders,
  sendManualRecommendationAdmin,
  suggestItemsForCustomerAdmin,
  upsertCustomerRecommendationAdmin,
} from "./admin.controller.js";
import { getStoreSettingsAdmin, putStoreSettingsAdmin } from "../storeSettings/storeSettings.controller.js";

export function createAdminRouter(env: Env): Router {
  const router = Router();
  router.use(requireAuth(env.JWT_SECRET), requireAdmin);

  router.get("/analytics", getAnalytics);

  router.get("/store-settings", getStoreSettingsAdmin);
  router.put("/store-settings", putStoreSettingsAdmin);

  router.get("/feedback", listFeedbackAdmin);
  router.patch("/feedback/:id/status", updateFeedbackStatusAdmin);
  router.patch("/feedback/:id/respond", respondToFeedbackAdmin);

  router.get("/orders", listOrders);
  router.patch("/orders/:id/status", advanceOrderStatus);

  router.get("/customers", listCustomersAdmin);
  router.get("/customers/:id", getCustomerAdmin);
  router.get("/customers/:id/suggested-items", suggestItemsForCustomerAdmin);
  router.post("/customers/:id/recommend", sendManualRecommendationAdmin(env));
  router.get("/customers/:id/recommendations", listCustomerRecommendationsAdmin);
  router.put("/customers/:id/recommendations", upsertCustomerRecommendationAdmin);

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

  router.get("/tiffin/dishes", listTiffinDishesAdmin);
  router.put("/tiffin/dishes", upsertTiffinDishAdmin);
  router.post("/tiffin/dishes/upload-image", uploadTiffinDishImage, handleTiffinDishImageUpload);
  router.get("/tiffin/add-on-prices", listAddOnPricesAdmin);
  router.put("/tiffin/add-on-prices", upsertAddOnPriceAdmin);

  router.get("/tiffin/festival-specials", listFestivalSpecialsAdmin);
  router.put("/tiffin/festival-specials", upsertFestivalSpecialAdmin);
  router.delete("/tiffin/festival-specials/:id", deleteFestivalSpecialAdmin);

  router.get("/tiffin/closures", listClosuresAdmin);
  router.post("/tiffin/closures", declareClosureAdmin);

  router.get("/coupons", listCouponsAdmin);
  router.post("/coupons", createCouponAdmin);
  router.put("/coupons/:id", updateCouponAdmin);
  router.delete("/coupons/:id", deleteCouponAdmin);

  return router;
}
