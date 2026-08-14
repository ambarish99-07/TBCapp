import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getMySubscriptions,
  getPlans,
  getUpcomingMeals,
  postPauseSubscription,
  postResumeSubscription,
  postSkipMeal,
  postSubscription,
} from "./tiffin.controller.js";

/** GG Tiffin's own module — subscribing requires an account, same as the rest of ordering. */
export function createTiffinRouter(env: Env): Router {
  const router = Router();

  router.get("/plans", getPlans);
  router.post("/subscriptions", requireAuth(env.JWT_SECRET), postSubscription(env));
  router.get("/subscriptions/mine", requireAuth(env.JWT_SECRET), getMySubscriptions);
  router.get("/subscriptions/:id/meals", requireAuth(env.JWT_SECRET), getUpcomingMeals);
  router.post("/subscriptions/:id/meals/:mealId/skip", requireAuth(env.JWT_SECRET), postSkipMeal);
  router.post("/subscriptions/:id/pause", requireAuth(env.JWT_SECRET), postPauseSubscription);
  router.post("/subscriptions/:id/resume", requireAuth(env.JWT_SECRET), postResumeSubscription);

  return router;
}
