import { getRecommendations } from "@tbc/pricing";
import { isComboLineId } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import type { Env } from "../../config/env.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { OrderModel } from "../../db/models/Order.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendProductRecommendation } from "../../integrations/whatsapp/sendRecommendation.js";

export const listOrders: RequestHandler = async (req, res) => {
  const { status } = req.query as { status?: string };
  const filter = status ? { status } : {};
  const orders = await OrderModel.find(filter).sort({ createdAt: -1 });
  res.json({ orders });
};

const ADVANCEABLE_STATUSES = ["received", "preparing", "out-for-delivery", "delivered", "cancelled"];

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
