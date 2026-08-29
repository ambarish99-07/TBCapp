import { RespondToFeedbackRequestSchema, SubmitFeedbackRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import { FeedbackModel } from "../../db/models/Feedback.model.js";
import { OrderModel } from "../../db/models/Order.model.js";
import {
  FeedbackValidationError,
  listFeedbackAdmin as listFeedbackAdminService,
  respondToFeedbackAdmin as respondToFeedbackAdminService,
  submitFeedback,
  updateFeedbackStatusAdmin as updateFeedbackStatusAdminService,
} from "./feedback.service.js";

// --- Customer-facing (mounted under /orders/:id/feedback) ---

export const postFeedback: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = SubmitFeedbackRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid feedback payload", details: parsed.error.flatten() });
    return;
  }

  try {
    const feedback = await submitFeedback(req.params.id, req.user.userId, parsed.data);
    res.status(201).json({ feedback });
  } catch (err) {
    if (err instanceof FeedbackValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
};

/** Lets the order detail / history screen ask "has this order already been reviewed?" so it can
 * show the submitted feedback (or nothing) instead of the "Rate & Review" prompt again. */
export const getFeedbackForMyOrder: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const order = await OrderModel.findById(req.params.id).select("userId");
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (!order.userId || String(order.userId) !== req.user.userId) {
    res.status(403).json({ error: "Not authorized to view this order's feedback" });
    return;
  }
  const feedback = await FeedbackModel.findOne({ orderId: order._id });
  res.json({ feedback });
};

// --- Admin-facing (mounted under /admin/feedback) ---

export const listFeedbackAdmin: RequestHandler = async (req, res) => {
  const { type, status, brandId } = req.query as { type?: string; status?: string; brandId?: string };
  const feedback = await listFeedbackAdminService({ type, status, brandId });
  res.json({ feedback });
};

export const updateFeedbackStatusAdmin: RequestHandler = async (req, res) => {
  const { status } = req.body as { status?: string };
  if (!status) {
    res.status(400).json({ error: "Status is required" });
    return;
  }
  try {
    const feedback = await updateFeedbackStatusAdminService(req.params.id, status);
    if (!feedback) {
      res.status(404).json({ error: "Feedback not found" });
      return;
    }
    res.json({ feedback });
  } catch (err) {
    if (err instanceof FeedbackValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
};

export const respondToFeedbackAdmin: RequestHandler = async (req, res) => {
  const parsed = RespondToFeedbackRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid response payload", details: parsed.error.flatten() });
    return;
  }
  const feedback = await respondToFeedbackAdminService(req.params.id, parsed.data.adminResponse);
  if (!feedback) {
    res.status(404).json({ error: "Feedback not found" });
    return;
  }
  res.json({ feedback });
};
