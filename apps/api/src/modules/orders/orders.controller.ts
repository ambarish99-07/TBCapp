import { CreateOrderRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import type { Env } from "../../config/env.js";
import { PriceResolutionError } from "../pricing/priceResolver.js";
import {
  createOrder,
  findOrderByAccessToken,
  findOrderById,
  listOrdersForUser,
  OrderValidationError,
} from "./orders.service.js";

export function postOrder(env: Env): RequestHandler {
  return async (req, res) => {
    const parsed = CreateOrderRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid order payload", details: parsed.error.flatten() });
      return;
    }

    try {
      const order = await createOrder(env, parsed.data, req.user?.userId ?? null);
      res.status(201).json({ order });
    } catch (err) {
      if (err instanceof PriceResolutionError || err instanceof OrderValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  };
}

export const getOrderByAccessToken: RequestHandler = async (req, res) => {
  const order = await findOrderByAccessToken(req.params.accessToken);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json({ order });
};

export const getOrderById: RequestHandler = async (req, res) => {
  const order = await findOrderById(req.params.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const isOwner = order.userId && String(order.userId) === req.user?.userId;
  const isAdmin = req.user?.role === "admin";
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "Not authorized to view this order" });
    return;
  }
  res.json({ order });
};

export const getMyOrders: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const orders = await listOrdersForUser(req.user.userId);
  res.json({ orders });
};
