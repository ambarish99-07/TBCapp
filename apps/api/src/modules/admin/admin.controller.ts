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
  const { status, brandId } = req.query as { status?: string; brandId?: string };
  const filter: Record<string, string> = {};
  if (status) filter.status = status;
  if (brandId) filter.brandId = brandId;
  const orders = await OrderModel.find(filter).sort({ createdAt: -1 });
  res.json({ orders });
};

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
