import { UpsertComboRequestSchema, UpsertMenuAddOnPriceRequestSchema, UpsertMenuItemRequestSchema } from "@tbc/shared-types";
import type { Request, RequestHandler, Response } from "express";
import { AdminRecommendationModel } from "../../db/models/AdminRecommendation.model.js";
import { ComboModel } from "../../db/models/Combo.model.js";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import {
  browseCategorySummaries,
  listAddOnPrices,
  listAllCombos,
  listCombos,
  listMenuItems,
  searchMenuItemsAcrossBrands,
  upsertAddOnPrice,
  withResolvedAddOns,
} from "./menu.service.js";

/** Mongoose documents carry `_id`, but the shared MenuItem/Combo schemas the client relies on expect `id`. */
function withId<T extends { _id: unknown }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

/** getMyRecommendations is mounted behind requireAuth — this only guards TypeScript's optional
 * `req.user`, same defensive pattern tiffin.controller.ts's requireUserId uses. */
function requireUserId(req: Request, res: Response): string | null {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return req.user.userId;
}

export const getMenu: RequestHandler = async (req, res) => {
  const { brandId } = req.query as { brandId?: string };
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }
  const items = await withResolvedAddOns(await listMenuItems(brandId));
  res.json({ items: items.map(withId) });
};

export const getCombos: RequestHandler = async (req, res) => {
  const { brandId } = req.query as { brandId?: string };
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }
  const combos = await listCombos(brandId);
  res.json({ combos: combos.map(withId) });
};

export const getAllCombos: RequestHandler = async (_req, res) => {
  const combos = await listAllCombos();
  res.json({ combos: combos.map(withId) });
};

export const getBrowseCategories: RequestHandler = async (_req, res) => {
  const categories = await browseCategorySummaries();
  res.json({ categories });
};

export const searchMenu: RequestHandler = async (req, res) => {
  const { q, category } = req.query as { q?: string; category?: string };
  const items = await withResolvedAddOns(await searchMenuItemsAcrossBrands({ q, category }));
  res.json({ items: items.map(withId) });
};

export const getAddOnPrices: RequestHandler = async (_req, res) => {
  const prices = await listAddOnPrices();
  res.json({ addOnPrices: prices.map((p) => withId(p.toObject())) });
};

export const upsertAddOnPriceAdmin: RequestHandler = async (req, res) => {
  const parsed = UpsertMenuAddOnPriceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid add-on price payload", details: parsed.error.flatten() });
    return;
  }
  const price = await upsertAddOnPrice(parsed.data);
  res.json({ addOnPrice: withId(price.toObject()) });
};

/** This customer's admin-curated "Recommended For You" pick for one brand (see
 * AdminRecommendationModel) — mounted behind requireAuth, so req.user is always set here. Empty
 * when the admin hasn't set one for this customer/brand, which is the common case. */
export const getMyRecommendations: RequestHandler = async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { brandId } = req.query as { brandId?: string };
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }
  const recommendation = await AdminRecommendationModel.findOne({ userId, brandId }).lean();
  res.json({ itemIds: recommendation?.itemIds ?? [] });
};

/** Admin create/update — the admin panel's Menu Items page uses this for both, since a new
 * item's id (slug) never collides with an existing one in practice, and editing needs the exact
 * same set of fields anyway. */
export const upsertMenuItem: RequestHandler = async (req, res) => {
  const parsed = UpsertMenuItemRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid menu item payload", details: parsed.error.flatten() });
    return;
  }
  const { id, ...update } = parsed.data;
  const item = await MenuItemModel.findByIdAndUpdate(id, update, { upsert: true, new: true, runValidators: true });
  const [resolved] = item ? await withResolvedAddOns([item.toObject()]) : [null];
  res.json({ item: resolved ? withId(resolved) : null });
};

export const deleteMenuItem: RequestHandler = async (req, res) => {
  await MenuItemModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};

/** Admin create/update for combos — same one-call upsert pattern as menu items. `$unset` clears
 * whichever type-specific fields don't belong to the submitted type, so switching a combo's type
 * on an edit doesn't leave stale curated/choose-n fields behind. */
export const upsertCombo: RequestHandler = async (req, res) => {
  const parsed = UpsertComboRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid combo payload", details: parsed.error.flatten() });
    return;
  }
  const { id, type, itemIds, chooseCount, eligibleItemIds, discountPercent, ...rest } = parsed.data;
  const set: Record<string, unknown> = { type, ...rest };
  const unset: Record<string, unknown> = {};
  // null ⇒ explicitly clear the override (back to the global default); undefined ⇒ leave untouched.
  if (discountPercent === null) {
    unset.discountPercent = "";
  } else if (discountPercent !== undefined) {
    set.discountPercent = discountPercent;
  }
  if (type === "curated") {
    set.itemIds = itemIds;
    unset.chooseCount = "";
    unset.eligibleItemIds = "";
  } else {
    set.chooseCount = chooseCount;
    set.eligibleItemIds = eligibleItemIds;
    unset.itemIds = "";
  }
  const combo = await ComboModel.findByIdAndUpdate(
    id,
    { $set: set, $unset: unset },
    { upsert: true, new: true, runValidators: true }
  );
  res.json({ combo: combo ? withId(combo.toObject()) : null });
};

export const deleteCombo: RequestHandler = async (req, res) => {
  await ComboModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
