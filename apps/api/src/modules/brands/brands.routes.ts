import { Router } from "express";
import type { Env } from "../../config/env.js";
import { getBrandStoreStatusPublic } from "../storeSettings/brandStoreSettings.controller.js";
import { listComingSoonBrands, listLiveBrands } from "./brands.controller.js";

export function createBrandsRouter(_env: Env): Router {
  const router = Router();

  router.get("/", listLiveBrands);
  router.get("/coming-soon", listComingSoonBrands);
  // Public — no auth — mirrors /store/status but scoped to one brand; already factors in the
  // Lickyeat-wide switch, so this alone is enough for the mobile app to know if THIS brand is
  // orderable right now. Never meaningful for gg-tiffin, which has its own separate system.
  router.get("/:brandId/status", getBrandStoreStatusPublic);

  return router;
}
