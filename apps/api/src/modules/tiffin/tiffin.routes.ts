import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getMySubscriptions,
  getPlans,
  getUpcomingMeals,
  postCancelSubscription,
  postPauseSubscription,
  postResumeSubscription,
  postSkipMeal,
  postSubscription,
  postTiffinRazorpayOrder,
  postTiffinRazorpayVerify,
  postUnskipMeal,
} from "./tiffin.controller.js";
import {
  getMySingleMealOrders,
  getSingleMealMenu,
  postCancelSingleMealOrder,
  postSingleMealOrder,
  postSingleMealRazorpayOrder,
  postSingleMealRazorpayVerify,
} from "./singleMeal.controller.js";
import { getWeeklyMenu } from "./tiffinMenu.controller.js";
import { getUpcomingClosuresPublic } from "./tiffinClosure.controller.js";

/** GG Tiffin's own module — subscribing requires an account, same as the rest of ordering. */
export function createTiffinRouter(env: Env): Router {
  const router = Router();

  router.get("/plans", getPlans);
  // The full single-meal weekly rotation — public, same as /plans and /single-meal/menu — powers
  // the mobile app's menu-browsing screens (Weekly Menu, plan preview) directly, no local copy.
  router.get("/weekly-menu", getWeeklyMenu);
  // Public — powers a "closed" banner on the mobile app's GG Tiffin screens, same spirit as
  // /store/status for the catalog brands.
  router.get("/closures/upcoming", getUpcomingClosuresPublic);
  router.post("/subscriptions", requireAuth(env.JWT_SECRET), postSubscription(env));
  router.get("/subscriptions/mine", requireAuth(env.JWT_SECRET), getMySubscriptions);
  router.get("/subscriptions/:id/meals", requireAuth(env.JWT_SECRET), getUpcomingMeals);
  router.post("/subscriptions/:id/meals/:mealId/skip", requireAuth(env.JWT_SECRET), postSkipMeal);
  router.post("/subscriptions/:id/meals/:mealId/unskip", requireAuth(env.JWT_SECRET), postUnskipMeal);
  router.post("/subscriptions/:id/pause", requireAuth(env.JWT_SECRET), postPauseSubscription);
  router.post("/subscriptions/:id/resume", requireAuth(env.JWT_SECRET), postResumeSubscription);
  router.post("/subscriptions/:id/cancel", requireAuth(env.JWT_SECRET), postCancelSubscription);
  router.post("/subscriptions/:id/razorpay-order", requireAuth(env.JWT_SECRET), postTiffinRazorpayOrder(env));
  router.post("/subscriptions/:id/razorpay-verify", requireAuth(env.JWT_SECRET), postTiffinRazorpayVerify(env));

  // Single-meal purchase — a one-off tiffin, no subscription. The menu is public (same as /plans);
  // ordering requires an account, same as everything else.
  router.get("/single-meal/menu", getSingleMealMenu(env));
  router.post("/single-meal/orders", requireAuth(env.JWT_SECRET), postSingleMealOrder(env));
  router.get("/single-meal/orders/mine", requireAuth(env.JWT_SECRET), getMySingleMealOrders);
  router.post("/single-meal/orders/:id/cancel", requireAuth(env.JWT_SECRET), postCancelSingleMealOrder);
  router.post("/single-meal/orders/:id/razorpay-order", requireAuth(env.JWT_SECRET), postSingleMealRazorpayOrder(env));
  router.post("/single-meal/orders/:id/razorpay-verify", requireAuth(env.JWT_SECRET), postSingleMealRazorpayVerify(env));

  return router;
}
