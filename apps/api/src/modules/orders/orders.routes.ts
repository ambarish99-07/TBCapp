import { Router } from "express";
import type { Env } from "../../config/env.js";
import { optionalAuth, requireAuth } from "../auth/auth.middleware.js";
import {
  getMyOrders,
  getOrderByAccessToken,
  getOrderById,
  postCancelOrderByAccessToken,
  postOrder,
} from "./orders.controller.js";

export function createOrdersRouter(env: Env): Router {
  const router = Router();

  router.post("/", optionalAuth(env.JWT_SECRET), postOrder(env));
  router.get("/mine", requireAuth(env.JWT_SECRET), getMyOrders);
  router.get("/guest/:accessToken", getOrderByAccessToken);
  // No auth — same trust model as the lookup above, the accessToken itself is the capability.
  router.post("/guest/:accessToken/cancel", postCancelOrderByAccessToken);
  router.get("/:id", requireAuth(env.JWT_SECRET), getOrderById);

  return router;
}
