import { Router } from "express";
import type { Env } from "../../config/env.js";
import { login, me, requestOtp, signup, verifyOtp } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import { loginRateLimiter, otpRequestRateLimiter, otpVerifyRateLimiter, signupRateLimiter } from "./rateLimit.js";

export function createAuthRouter(env: Env): Router {
  const router = Router();

  router.post("/signup", signupRateLimiter, signup(env));
  router.post("/login", loginRateLimiter, login(env));
  router.post("/otp/request", otpRequestRateLimiter, requestOtp(env));
  router.post("/otp/verify", otpVerifyRateLimiter, verifyOtp(env));
  router.get("/me", requireAuth(env.JWT_SECRET), me);

  return router;
}
