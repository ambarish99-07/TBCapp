import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAdmin, requireAuth } from "../auth/auth.middleware.js";
import {
  deleteCombo,
  deleteMenuItem,
  getAddOnPrices,
  getAllCombos,
  getBrowseCategories,
  getCombos,
  getMenu,
  getMyRecommendations,
  searchMenu,
  upsertAddOnPriceAdmin,
  upsertCombo,
  upsertMenuItem,
} from "./menu.controller.js";
import { handleMenuItemImageUpload, uploadMenuItemImage } from "./upload.js";

export function createMenuRouter(env: Env): Router {
  const router = Router();

  router.get("/", getMenu);
  router.get("/combos/all", getAllCombos);
  router.get("/combos", getCombos);
  router.get("/browse-categories", getBrowseCategories);
  router.get("/search", searchMenu);
  router.get("/my-recommendations", requireAuth(env.JWT_SECRET), getMyRecommendations);
  // Public — the customize UI needs to show "+₹X" for whichever add-ons an item offers, same as
  // GG Tiffin's weekly-menu response already embeds resolved add-on prices per dish.
  router.get("/add-on-prices", getAddOnPrices);

  router.put("/", requireAuth(env.JWT_SECRET), requireAdmin, upsertMenuItem);
  router.delete("/:id", requireAuth(env.JWT_SECRET), requireAdmin, deleteMenuItem);
  router.put("/add-on-prices", requireAuth(env.JWT_SECRET), requireAdmin, upsertAddOnPriceAdmin);
  router.put("/combos", requireAuth(env.JWT_SECRET), requireAdmin, upsertCombo);
  router.delete("/combos/:id", requireAuth(env.JWT_SECRET), requireAdmin, deleteCombo);
  // Separate from the JSON upsert above — multipart/form-data, just the file, returns the URL to
  // include as `image` in a PUT /menu call (create or edit).
  router.post("/upload-image", requireAuth(env.JWT_SECRET), requireAdmin, uploadMenuItemImage, handleMenuItemImageUpload);

  return router;
}
