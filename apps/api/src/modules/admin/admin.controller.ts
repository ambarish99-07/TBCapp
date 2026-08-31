import { getRecommendations } from "@tbc/pricing";
import { isComboLineId, SetAdminRecommendationRequestSchema, type OrderDeliveryPartner } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import type { Env } from "../../config/env.js";
import { AdminRecommendationModel } from "../../db/models/AdminRecommendation.model.js";
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

/** Mongoose documents carry `_id`, but the shared User schema the client relies on expects `id` —
 * same convention menu.controller.ts's own `withId` uses. Missing this here (as these two
 * customer endpoints originally were) meant every search result's `customer.id` was `undefined`,
 * so clicking "View" on the admin panel navigated to `/customers/undefined` and 400'd. */
function withId<T extends { _id: unknown }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

const DEFAULT_CUSTOMERS_PAGE_SIZE = 50;
const MAX_CUSTOMERS_PAGE_SIZE = 200;

/**
 * Finds a registered customer by name, phone, or email — the admin panel's entry point into a
 * specific customer's order history and manual recommendation tool. With no `q`, browses every
 * customer (paginated, alphabetical by name) instead of returning nothing — so the admin panel
 * can be used as a plain phone-book of every customer's number, not just a search box that
 * requires already knowing who you're looking for.
 */
export const listCustomersAdmin: RequestHandler = async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_CUSTOMERS_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_CUSTOMERS_PAGE_SIZE));

  const filter: Record<string, unknown> = { role: "customer" };
  if (q) {
    const re = new RegExp(escapeRegExp(q), "i");
    filter.$or = [{ fullName: re }, { phone: re }, { email: re }];
  }

  const [customers, total] = await Promise.all([
    UserModel.find(filter)
      .select("fullName phone email createdAt")
      .sort({ fullName: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  res.json({ customers: customers.map(withId), total, page, pageSize });
};

export const getCustomerAdmin: RequestHandler = async (req, res) => {
  const customer = await UserModel.findOne({ _id: req.params.id, role: "customer" }).select("fullName phone email createdAt").lean();
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json({ customer: withId(customer) });
};

/** Every brand this customer currently has an admin-curated "Recommended For You" pick for —
 * powers the Customer Detail page's per-brand picker, so it opens already showing what's live. */
export const listCustomerRecommendationsAdmin: RequestHandler = async (req, res) => {
  const recommendations = await AdminRecommendationModel.find({ userId: req.params.id });
  res.json({ recommendations: recommendations.map((r) => ({ brandId: r.brandId, itemIds: r.itemIds })) });
};

/**
 * Sets (or clears, with an empty `itemIds`) this customer's admin-curated "Recommended For You"
 * pick for one brand — read live by the mobile app's own Home screen (see
 * apps/mobile/src/api/menu.api.ts's useMyRecommendations), not just sent as a one-off WhatsApp
 * message the way sendManualRecommendationAdmin below is. Capped at 2 items by the request schema.
 */
export const upsertCustomerRecommendationAdmin: RequestHandler = async (req, res) => {
  const parsed = SetAdminRecommendationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid recommendation payload", details: parsed.error.flatten() });
    return;
  }
  const customer = await UserModel.findOne({ _id: req.params.id, role: "customer" });
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const { brandId, itemIds } = parsed.data;
  if (itemIds.length === 0) {
    await AdminRecommendationModel.deleteOne({ userId: req.params.id, brandId });
  } else {
    await AdminRecommendationModel.findOneAndUpdate({ userId: req.params.id, brandId }, { itemIds }, { upsert: true, runValidators: true });
  }
  res.json({ brandId, itemIds });
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
 * Read-only purchase-history-based suggestion (spec §6's scoring, via the pure getRecommendations
 * function from @tbc/pricing) for one customer — across every order they've ever placed, not just
 * one. Lives here (not on an individual order) so it's reachable from the same Customer Detail
 * page as the manual WhatsApp picker and the persisted in-app "Recommended For You" tool: one
 * place to review a customer's history and decide what to recommend, instead of a scattered
 * per-order trigger. Never sends anything itself — just returns names for the admin to review
 * (and deselect/add to) before choosing to send via the manual tool below it.
 */
export const suggestItemsForCustomerAdmin: RequestHandler = async (req, res) => {
  const customer = await UserModel.findOne({ _id: req.params.id, role: "customer" });
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const [customerOrders, allMenuItems] = await Promise.all([
    OrderModel.find({ userId: req.params.id }),
    MenuItemModel.find().lean(),
  ]);

  const orderedMenuItemIds = Array.from(
    new Set(
      customerOrders
        .flatMap((o) => o.items.map((line) => line.menuItemId))
        .filter((id) => !isComboLineId(id))
    )
  );
  const pairableItems = allMenuItems.map((item) => ({ id: String(item._id), pairsWith: item.pairsWith }));
  const popularityFallbackIds = allMenuItems.filter((item) => item.isPopular).map((item) => String(item._id));

  const suggestedIds = getRecommendations(orderedMenuItemIds, pairableItems, popularityFallbackIds, 3);
  const itemNames = suggestedIds
    .map((id) => allMenuItems.find((item) => String(item._id) === id)?.signatureName)
    .filter((name): name is string => Boolean(name));

  res.json({ itemNames });
};
