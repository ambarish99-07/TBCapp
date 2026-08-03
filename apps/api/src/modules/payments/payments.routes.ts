import { Router } from "express";
import type { Env } from "../../config/env.js";
import { createRazorpayOrderHandler, verifyRazorpayPaymentHandler } from "./payments.controller.js";

export function createPaymentsRouter(env: Env): Router {
  const router = Router();

  router.post("/razorpay/order", createRazorpayOrderHandler(env));
  router.post("/razorpay/verify", verifyRazorpayPaymentHandler(env));

  return router;
}
