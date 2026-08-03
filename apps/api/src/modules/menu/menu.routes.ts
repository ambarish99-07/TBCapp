import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAdmin, requireAuth } from "../auth/auth.middleware.js";
import { deleteMenuItem, getCombos, getMenu, upsertMenuItem } from "./menu.controller.js";

export function createMenuRouter(env: Env): Router {
  const router = Router();

  router.get("/", getMenu);
  router.get("/combos", getCombos);

  router.put("/", requireAuth(env.JWT_SECRET), requireAdmin, upsertMenuItem);
  router.delete("/:id", requireAuth(env.JWT_SECRET), requireAdmin, deleteMenuItem);

  return router;
}
