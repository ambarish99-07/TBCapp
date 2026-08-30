import { UpsertMenuItemRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { browseCategorySummaries, listAllCombos, listCombos, listMenuItems, searchMenuItemsAcrossBrands } from "./menu.service.js";

/** Mongoose documents carry `_id`, but the shared MenuItem/Combo schemas the client relies on expect `id`. */
function withId<T extends { _id: unknown }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

export const getMenu: RequestHandler = async (req, res) => {
  const { brandId } = req.query as { brandId?: string };
  if (!brandId) {
    res.status(400).json({ error: "brandId is required" });
    return;
  }
  const items = await listMenuItems(brandId);
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
  const items = await searchMenuItemsAcrossBrands({ q, category });
  res.json({ items: items.map(withId) });
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
  res.json({ item: item ? withId(item.toObject()) : null });
};

export const deleteMenuItem: RequestHandler = async (req, res) => {
  await MenuItemModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
