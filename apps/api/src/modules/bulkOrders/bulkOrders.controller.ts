import { CreateBulkOrderInquiryRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import type { Env } from "../../config/env.js";
import { BulkOrderInquiryModel } from "../../db/models/BulkOrderInquiry.model.js";
import { sendBulkOrderInquiryAlert } from "../../integrations/whatsapp/sendBulkOrderAlert.js";

const ADVANCEABLE_STATUSES = ["new", "contacted", "closed"];

export function createBulkOrderInquiry(env: Env): RequestHandler {
  return async (req, res) => {
    const parsed = CreateBulkOrderInquiryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid inquiry payload", details: parsed.error.flatten() });
      return;
    }

    const inquiry = await BulkOrderInquiryModel.create(parsed.data);

    sendBulkOrderInquiryAlert(env, {
      name: inquiry.name,
      phone: inquiry.phone,
      occasion: inquiry.occasion ?? undefined,
    }).catch((err) => console.error("[bulk-orders] inquiry alert threw unexpectedly:", err));

    res.status(201).json({ inquiry });
  };
}

export const listBulkOrderInquiries: RequestHandler = async (_req, res) => {
  const inquiries = await BulkOrderInquiryModel.find().sort({ createdAt: -1 });
  res.json({ inquiries });
};

export const updateBulkOrderInquiryStatus: RequestHandler = async (req, res) => {
  const { status } = req.body as { status?: string };
  if (!status || !ADVANCEABLE_STATUSES.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const inquiry = await BulkOrderInquiryModel.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!inquiry) {
    res.status(404).json({ error: "Inquiry not found" });
    return;
  }
  res.json({ inquiry });
};
