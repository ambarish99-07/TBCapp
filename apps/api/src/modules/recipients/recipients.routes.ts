import { Router } from "express";
import type { Env } from "../../config/env.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { createRecipient, deleteRecipient, listRecipients, updateRecipient } from "./recipients.controller.js";

export function createRecipientsRouter(env: Env): Router {
  const router = Router();

  router.use(requireAuth(env.JWT_SECRET));
  router.get("/", listRecipients);
  router.post("/", createRecipient);
  router.patch("/:id", updateRecipient);
  router.delete("/:id", deleteRecipient);

  return router;
}
