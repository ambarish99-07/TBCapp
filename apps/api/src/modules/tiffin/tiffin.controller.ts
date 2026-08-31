import {
  CreateTiffinPlanRequestSchema,
  CreateTiffinSubscriptionRequestSchema,
  PauseTiffinSubscriptionRequestSchema,
  TiffinScheduledMealStatusSchema,
  UpdateTiffinPlanRequestSchema,
} from "@tbc/shared-types";
import type { Request, RequestHandler, Response } from "express";
import type { Env } from "../../config/env.js";
import { OrderValidationError } from "../orders/orders.errors.js";
import * as tiffinService from "./tiffin.service.js";
import { TiffinValidationError } from "./tiffin.errors.js";

/** Both errors mean "well-formed input, not acceptable" — same 400 treatment as orders.controller.ts. */
function handleTiffinError(err: unknown, res: Response): boolean {
  if (err instanceof TiffinValidationError || err instanceof OrderValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

/** Every route here is mounted behind requireAuth — this only guards TypeScript's optional `req.user`. */
function requireUserId(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.user.userId;
}

export const getPlans: RequestHandler = async (_req, res) => {
  const plans = await tiffinService.listActivePlans();
  res.json({ plans });
};

export function postSubscription(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = CreateTiffinSubscriptionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid subscription payload", details: parsed.error.flatten() });
      return;
    }

    try {
      const subscription = await tiffinService.createSubscription(env, userId, parsed.data);
      res.status(201).json({ subscription });
    } catch (err) {
      if (handleTiffinError(err, res)) return;
      throw err;
    }
  };
}

export const getMySubscriptions: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const subscriptions = await tiffinService.listMySubscriptions(userId);
  res.json({ subscriptions });
};

export const getUpcomingMeals: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const meals = await tiffinService.listUpcomingMeals(userId, req.params.id);
    res.json({ meals });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export const postSkipMeal: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const meal = await tiffinService.skipMeal(userId, req.params.id, req.params.mealId);
    res.json({ meal });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export const postUnskipMeal: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const meal = await tiffinService.unskipMeal(userId, req.params.id, req.params.mealId);
    res.json({ meal });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export const postPauseSubscription: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const parsed = PauseTiffinSubscriptionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pause payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const subscription = await tiffinService.pauseSubscription(userId, req.params.id, parsed.data);
    res.json({ subscription });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export const postResumeSubscription: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const subscription = await tiffinService.resumeSubscription(userId, req.params.id);
    res.json({ subscription });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export const postCancelSubscription: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const subscription = await tiffinService.cancelSubscription(userId, req.params.id);
    res.json({ subscription });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export function postTiffinRazorpayOrder(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const razorpayOrder = await tiffinService.createTiffinRazorpayOrder(env, userId, req.params.id);
      res.json(razorpayOrder);
    } catch (err) {
      if (handleTiffinError(err, res)) return;
      throw err;
    }
  };
}

export function postTiffinRazorpayVerify(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "Missing required verification fields" });
      return;
    }

    try {
      const subscription = await tiffinService.verifyTiffinRazorpayPayment(env, userId, req.params.id, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
      res.json({ subscription });
    } catch (err) {
      if (handleTiffinError(err, res)) return;
      throw err;
    }
  };
}

// --- Admin ---

export const listAllSubscriptionsAdmin: RequestHandler = async (_req, res) => {
  const subscriptions = await tiffinService.listAllSubscriptions();
  res.json({ subscriptions });
};

export const listTodaysScheduledMealsAdmin: RequestHandler = async (_req, res) => {
  const meals = await tiffinService.listTodaysScheduledMeals();
  res.json({ meals });
};

export const updateScheduledMealStatusAdmin: RequestHandler = async (req, res) => {
  const parsed = TiffinScheduledMealStatusSchema.safeParse(req.body?.status);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  try {
    const meal = await tiffinService.updateScheduledMealStatus(req.params.id, parsed.data);
    res.json({ meal });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export const listAllPlansAdmin: RequestHandler = async (_req, res) => {
  const plans = await tiffinService.listAllPlansAdmin();
  res.json({ plans });
};

export const createPlanAdmin: RequestHandler = async (req, res) => {
  const parsed = CreateTiffinPlanRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const plan = await tiffinService.createPlan(parsed.data);
    res.status(201).json({ plan });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};

export const updatePlanAdmin: RequestHandler = async (req, res) => {
  const parsed = UpdateTiffinPlanRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const plan = await tiffinService.updatePlan(req.params.id, parsed.data);
    res.json({ plan });
  } catch (err) {
    if (handleTiffinError(err, res)) return;
    throw err;
  }
};
