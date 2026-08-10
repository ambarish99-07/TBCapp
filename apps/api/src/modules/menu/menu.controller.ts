import type { RequestHandler } from "express";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { listCombos, listMenuItems } from "./menu.service.js";

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

/** Minimal admin CRUD — menu content is small/static, so no bulk-edit UI is provided here. */
export const upsertMenuItem: RequestHandler = async (req, res) => {
  const { id, ...update } = req.body;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  const item = await MenuItemModel.findByIdAndUpdate(id, update, { upsert: true, new: true, runValidators: true });
  res.json({ item: item ? withId(item.toObject()) : null });
};

export const deleteMenuItem: RequestHandler = async (req, res) => {
  await MenuItemModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
