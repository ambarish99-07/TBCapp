import {
  CreateSingleMealOrderRequestSchema,
  CreateTiffinMealPriceRequestSchema,
  TiffinSingleMealOrderStatusSchema,
  UpdateTiffinMealPriceRequestSchema,
} from "@tbc/shared-types";
import type { Request, RequestHandler, Response } from "express";
import type { Env } from "../../config/env.js";
import { OrderValidationError } from "../orders/orders.errors.js";
import * as singleMealService from "./singleMeal.service.js";
import { TiffinValidationError } from "./tiffin.errors.js";

/** Both errors mean "well-formed input, not acceptable" — same 400 treatment as tiffin.controller.ts. */
function handleSingleMealError(err: unknown, res: Response): boolean {
  if (err instanceof TiffinValidationError || err instanceof OrderValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

/** Every authenticated route here is mounted behind requireAuth — this only guards TypeScript's optional `req.user`. */
function requireUserId(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.user.userId;
}

export const getSingleMealMenu: RequestHandler = async (_req, res) => {
  const menu = await singleMealService.getSingleMealMenu();
  res.json({ menu });
};

export function postSingleMealOrder(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const parsed = CreateSingleMealOrderRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid order payload", details: parsed.error.flatten() });
      return;
    }

    try {
      const order = await singleMealService.createSingleMealOrder(env, userId, parsed.data);
      res.status(201).json({ order });
    } catch (err) {
      if (handleSingleMealError(err, res)) return;
      throw err;
    }
  };
}

export const getMySingleMealOrders: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const orders = await singleMealService.listMySingleMealOrders(userId);
  res.json({ orders });
};

export function postSingleMealRazorpayOrder(env: Env): RequestHandler {
  return async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const razorpayOrder = await singleMealService.createSingleMealRazorpayOrder(env, userId, req.params.id);
      res.json(razorpayOrder);
    } catch (err) {
      if (handleSingleMealError(err, res)) return;
      throw err;
    }
  };
}

export function postSingleMealRazorpayVerify(env: Env): RequestHandler {
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
      const order = await singleMealService.verifySingleMealRazorpayPayment(env, userId, req.params.id, {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });
      res.json({ order });
    } catch (err) {
      if (handleSingleMealError(err, res)) return;
      throw err;
    }
  };
}

// --- Admin ---

export const listTodaysSingleMealOrdersAdmin: RequestHandler = async (_req, res) => {
  const orders = await singleMealService.listTodaysSingleMealOrders();
  res.json({ orders });
};

export const updateSingleMealOrderStatusAdmin: RequestHandler = async (req, res) => {
  const parsed = TiffinSingleMealOrderStatusSchema.safeParse(req.body?.status);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  try {
    const order = await singleMealService.updateSingleMealOrderStatus(req.params.id, parsed.data);
    res.json({ order });
  } catch (err) {
    if (handleSingleMealError(err, res)) return;
    throw err;
  }
};

export const listMealPricesAdmin: RequestHandler = async (_req, res) => {
  const prices = await singleMealService.listMealPrices();
  res.json({ prices });
};

export const createMealPriceAdmin: RequestHandler = async (req, res) => {
  const parsed = CreateTiffinMealPriceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid meal price payload", details: parsed.error.flatten() });
    return;
  }
  const price = await singleMealService.createMealPrice(parsed.data);
  res.status(201).json({ price });
};

export const updateMealPriceAdmin: RequestHandler = async (req, res) => {
  const parsed = UpdateTiffinMealPriceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid meal price payload", details: parsed.error.flatten() });
    return;
  }
  try {
    const price = await singleMealService.updateMealPrice(req.params.id, parsed.data);
    res.json({ price });
  } catch (err) {
    if (handleSingleMealError(err, res)) return;
    throw err;
  }
};
