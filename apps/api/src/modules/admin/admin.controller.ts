import { getRecommendations } from "@tbc/pricing";
import { isComboLineId, type OrderDeliveryPartner } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import type { Env } from "../../config/env.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { OrderModel } from "../../db/models/Order.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendProductRecommendation } from "../../integrations/whatsapp/sendRecommendation.js";
import { getAnalyticsSummary } from "./analytics.service.js";

export const getAnalytics: RequestHandler = async (req, res) => {
  const { brandId } = req.query as { brandId?: string };
  const summary = await getAnalyticsSummary(brandId || undefined);
  res.json(summary);
};

export const listOrders: RequestHandler = async (req, res) => {
  const { status, brandId, userId } = req.query as { status?: string; brandId?: string; userId?: string };
  const filter: Record<string, string> = {};
  if (status) filter.status = status;
  if (brandId) filter.brandId = brandId;
  if (userId) filter.userId = userId;
  const orders = await OrderModel.find(filter).sort({ createdAt: -1 });
  res.json({ orders });
};

/** Escapes regex metacharacters so free-text search input can't be interpreted as a pattern —
 * same helper menu.service.ts's cross-brand search already uses, duplicated rather than shared
 * since it's a two-line utility not worth a new module for. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds a registered customer by name, phone, or email — the admin panel's entry point into a
 * specific customer's order history and manual recommendation tool. */
export const listCustomersAdmin: RequestHandler = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json({ customers: [] });
    return;
  }
  const re = new RegExp(escapeRegExp(q), "i");
  const customers = await UserModel.find({ role: "customer", $or: [{ fullName: re }, { phone: re }, { email: re }] })
    .select("fullName phone email createdAt")
    .sort({ fullName: 1 })
    .limit(25);
  res.json({ customers });
};

export const getCustomerAdmin: RequestHandler = async (req, res) => {
  const customer = await UserModel.findOne({ _id: req.params.id, role: "customer" }).select("fullName phone email createdAt");
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json({ customer });
};

/**
 * The admin-panel counterpart to `recommendToCustomer` above — that one auto-computes item names
 * from purchase history via getRecommendations; this one sends whatever specific item names the
 * admin picked by hand, after reviewing the customer's own order history first.
 */
export function sendManualRecommendationAdmin(env: Env): RequestHandler {
  return async (req, res) => {
    const { itemNames } = req.body as { itemNames?: string[] };
    if (!Array.isArray(itemNames) || itemNames.length === 0) {
      res.status(400).json({ error: "Please choose at least one item to recommend" });
      return;
    }

    const customer = await UserModel.findOne({ _id: req.params.id, role: "customer" });
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (!customer.phone) {
      res.status(400).json({ error: "Customer has no phone number on file" });
      return;
    }

    await sendProductRecommendation(env, { customerPhone: customer.phone, recommendedItemNames: itemNames });
    res.json({ recommendedItemNames: itemNames });
  };
}

const ADVANCEABLE_STATUSES = ["received", "preparing", "out-for-delivery", "delivered", "cancelled"];

/** There's no real rider app/dispatch system in this project — a rider is picked from this fixed
 * demo pool, deterministically by order id, once an order moves to "out-for-delivery" (same
 * pattern GG Tiffin's single-meal orders use, kept as a separate pool since the two order systems
 * are independent). */
const DELIVERY_PARTNER_POOL: OrderDeliveryPartner[] = [
  { name: "Ajay Singh", phone: "9835067890" },
  { name: "Deepak Prasad", phone: "9835078901" },
  { name: "Vikas Kumar", phone: "9835089012" },
  { name: "Rohit Sharma", phone: "9835090123" },
];

function pickDeliveryPartner(orderId: string): OrderDeliveryPartner {
  const seed = [...orderId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DELIVERY_PARTNER_POOL[seed % DELIVERY_PARTNER_POOL.length];
}

export const advanceOrderStatus: RequestHandler = async (req, res) => {
  const { status, note } = req.body as { status?: string; note?: string };
  if (!status || !ADVANCEABLE_STATUSES.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const order = await OrderModel.findById(req.params.id);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  order.status = status as (typeof ADVANCEABLE_STATUSES)[number] as typeof order.status;
  order.statusHistory.push({ status: order.status, at: new Date(), note });
  if (order.status === "out-for-delivery" && !order.deliveryPartner) {
    order.deliveryPartner = pickDeliveryPartner(String(order._id));
  }
  await order.save();
  res.json({ order });
};

/**
 * Manual trigger for the purchase-history-based recommendation (spec §6). The
 * scoring itself is the pure getRecommendations function from @tbc/pricing;
 * this handler's only job is gathering inputs (order history, menu, popularity
 * fallback) and handing the side effect off to sendProductRecommendation. A
 * future scheduled/automatic version can call getRecommendations the same way.
 */
export function recommendToCustomer(env: Env): RequestHandler {
  return async (req, res) => {
    const order = await OrderModel.findById(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!order.userId) {
      res.status(400).json({ error: "Recommendations require a registered customer" });
      return;
    }

    const [user, userOrders, allMenuItems] = await Promise.all([
      UserModel.findById(order.userId),
      OrderModel.find({ userId: order.userId }),
      MenuItemModel.find().lean(),
    ]);
    if (!user) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    if (!user.phone) {
      res.status(400).json({ error: "Customer has no phone number on file" });
      return;
    }

    const orderedMenuItemIds = Array.from(
      new Set(
        userOrders
          .flatMap((o) => o.items.map((line) => line.menuItemId))
          .filter((id) => !isComboLineId(id))
      )
    );
    const pairableItems = allMenuItems.map((item) => ({ id: String(item._id), pairsWith: item.pairsWith }));
    const popularityFallbackIds = allMenuItems.filter((item) => item.isPopular).map((item) => String(item._id));

    const recommendedIds = getRecommendations(orderedMenuItemIds, pairableItems, popularityFallbackIds, 3);
    const recommendedItemNames = recommendedIds
      .map((id) => allMenuItems.find((item) => String(item._id) === id)?.signatureName)
      .filter((name): name is string => Boolean(name));

    await sendProductRecommendation(env, { customerPhone: user.phone, recommendedItemNames });
    res.json({ recommendedItemNames });
  };
}
