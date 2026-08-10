import { Router } from "express";
import type { Env } from "../../config/env.js";
import { listLiveBrands } from "./brands.controller.js";

export function createBrandsRouter(_env: Env): Router {
  const router = Router();

  router.get("/", listLiveBrands);

  return router;
}
