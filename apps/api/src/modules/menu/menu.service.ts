import { MenuItemModel } from "../../db/models/MenuItem.model.js";
import { ComboModel } from "../../db/models/Combo.model.js";

export function listMenuItems() {
  return MenuItemModel.find().lean();
}

export function findMenuItemById(id: string) {
  return MenuItemModel.findById(id).lean();
}

export function listCombos() {
  return ComboModel.find().lean();
}

export function findComboById(id: string) {
  return ComboModel.findById(id).lean();
}
