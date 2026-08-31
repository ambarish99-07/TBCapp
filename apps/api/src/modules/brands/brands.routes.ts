import { Router } from "express";
import type { Env } from "../../config/env.js";
import { listComingSoonBrands, listLiveBrands } from "./brands.controller.js";

export function createBrandsRouter(_env: Env): Router {
  const router = Router();

  router.get("/", listLiveBrands);
  router.get("/coming-soon", listComingSoonBrands);

  return router;
}
