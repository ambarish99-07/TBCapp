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

/** GG Tiffin's own module — subscribing requires an account, same as the rest of ordering. */
export function createTiffinRouter(env: Env): Router {
  const router = Router();

  router.get("/plans", getPlans);
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

  return router;
}
