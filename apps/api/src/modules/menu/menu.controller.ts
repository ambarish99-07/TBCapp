import type { RequestHandler } from "express";
import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { listCombos, listMenuItems } from "./menu.service.js";

export const getMenu: RequestHandler = async (_req, res) => {
  const items = await listMenuItems();
  res.json({ items });
};

export const getCombos: RequestHandler = async (_req, res) => {
  const combos = await listCombos();
  res.json({ combos });
};

/** Minimal admin CRUD — menu content is small/static, so no bulk-edit UI is provided here. */
export const upsertMenuItem: RequestHandler = async (req, res) => {
  const { id, ...update } = req.body;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }
  const item = await MenuItemModel.findByIdAndUpdate(id, update, { upsert: true, new: true, runValidators: true });
  res.json({ item });
};

export const deleteMenuItem: RequestHandler = async (req, res) => {
  await MenuItemModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
