import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { ComboModel } from "../../db/models/Combo.model.js";

export function listMenuItems(brandId: string) {
  return MenuItemModel.find({ brandId }).lean();
}

export function findMenuItemById(id: string) {
  return MenuItemModel.findById(id).lean();
}

export function listCombos(brandId: string) {
  return ComboModel.find({ brandId }).lean();
}

export function findComboById(id: string) {
  return ComboModel.findById(id).lean();
}
