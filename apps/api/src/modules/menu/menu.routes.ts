import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAdmin, requireAuth } from "../auth/auth.middleware.js";
import { deleteMenuItem, getAllCombos, getBrowseCategories, getCombos, getMenu, searchMenu, upsertMenuItem } from "./menu.controller.js";
import { handleMenuItemImageUpload, uploadMenuItemImage } from "./upload.js";

export function createMenuRouter(env: Env): Router {
  const router = Router();

  router.get("/", getMenu);
  router.get("/combos/all", getAllCombos);
  router.get("/combos", getCombos);
  router.get("/browse-categories", getBrowseCategories);
  router.get("/search", searchMenu);

  router.put("/", requireAuth(env.JWT_SECRET), requireAdmin, upsertMenuItem);
  router.delete("/:id", requireAuth(env.JWT_SECRET), requireAdmin, deleteMenuItem);
  // Separate from the JSON upsert above — multipart/form-data, just the file, returns the URL to
  // include as `image` in a PUT /menu call (create or edit).
  router.post("/upload-image", requireAuth(env.JWT_SECRET), requireAdmin, uploadMenuItemImage, handleMenuItemImageUpload);

  return router;
}
