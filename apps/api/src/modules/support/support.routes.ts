import { CreateSupportTicketRequestSchema, UpdateSupportTicketRequestSchema } from "@tbc/shared-types";
import { Router, type RequestHandler, type Response } from "express";
import type { Env } from "../../config/env.js";
import { createImageUploadHandlers } from "../../utils/imageUpload.js";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  SupportValidationError,
  createSupportTicket,
  listMySupportTickets,
  listSupportTicketsAdmin,
  updateSupportTicketAdmin,
} from "./support.service.js";

function handleSupportError(err: unknown, res: Response): boolean {
  if (err instanceof SupportValidationError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  return false;
}

/** Customer side, mounted at /support — every route needs a logged-in account. */
export function createSupportRouter(env: Env): Router {
  const router = Router();
  router.use(requireAuth(env.JWT_SECRET));
  // Same validated upload pipeline as admin photos (PNG/JPEG/WEBP, 5 MB, random file name), in
  // its own folder so a ticket can only ever reference a photo this endpoint issued.
  const { uploadMiddleware, handleUpload } = createImageUploadHandlers(env, "support-images");

  router.post("/photo", uploadMiddleware, handleUpload);

  router.post("/tickets", async (req, res) => {
    const parsed = CreateSupportTicketRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid help request", details: parsed.error.flatten() });
      return;
    }
    try {
      const ticket = await createSupportTicket(req.user!.userId, parsed.data);
      res.status(201).json({ ticket });
    } catch (err) {
      if (handleSupportError(err, res)) return;
      throw err;
    }
  });

  router.get("/tickets/mine", async (req, res) => {
    res.json({ tickets: await listMySupportTickets(req.user!.userId) });
  });

  return router;
}

// --- Admin (mounted inside the admin router, which already requires an admin) ---

export const listSupportTicketsAdminHandler: RequestHandler = async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json({ tickets: await listSupportTicketsAdmin(status) });
};

export const updateSupportTicketAdminHandler: RequestHandler = async (req, res) => {
  const parsed = UpdateSupportTicketRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() });
    return;
  }
  try {
    res.json({ ticket: await updateSupportTicketAdmin(req.params.id, parsed.data) });
  } catch (err) {
    if (handleSupportError(err, res)) return;
    throw err;
  }
};
