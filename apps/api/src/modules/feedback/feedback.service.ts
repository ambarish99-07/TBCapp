import type { SubmitFeedbackRequest } from "@tbc/shared-types";
import { FeedbackModel } from "../../db/models/Feedback.model.js";
import { OrderModel } from "../../db/models/Order.model.js";

/** Thrown for any feedback-submission input that's well-formed but not acceptable (wrong owner,
 * order not delivered yet, already submitted). Caught in feedback.controller.ts and returned as 400. */
export class FeedbackValidationError extends Error {}

/**
 * One combined form per order — a star-rating review or an issue-report complaint, never both.
 * Only the order's own registered customer can submit it (a guest checkout has no account this
 * could be attributed to), and only once the order is actually delivered — there's nothing
 * meaningful to rate or complain about before then, and an in-flight problem (wrong address,
 * hasn't arrived yet) belongs to a live support channel, not this async form.
 */
export async function submitFeedback(orderId: string, userId: string, request: SubmitFeedbackRequest) {
  const order = await OrderModel.findById(orderId);
  if (!order) {
    throw new FeedbackValidationError("Order not found");
  }
  if (!order.userId || String(order.userId) !== userId) {
    throw new FeedbackValidationError("You can only leave feedback on your own orders");
  }
  if (order.status !== "delivered") {
    throw new FeedbackValidationError("Feedback can only be left once an order has been delivered");
  }

  const existing = await FeedbackModel.findOne({ orderId: order._id });
  if (existing) {
    throw new FeedbackValidationError("Feedback has already been submitted for this order");
  }

  return FeedbackModel.create({
    orderId: order._id,
    orderNumber: order.orderNumber,
    brandId: order.brandId,
    userId,
    customerName: order.customer?.name ?? order.delivery.fullName,
    type: request.isComplaint ? "complaint" : "review",
    rating: request.rating,
    category: request.category,
    message: request.message,
  });
}

export async function listFeedbackAdmin(filter: { type?: string; status?: string; brandId?: string }) {
  const query: Record<string, string> = {};
  if (filter.type) query.type = filter.type;
  if (filter.status) query.status = filter.status;
  if (filter.brandId) query.brandId = filter.brandId;
  return FeedbackModel.find(query).sort({ createdAt: -1 });
}

const ADVANCEABLE_STATUSES = ["open", "in-progress", "resolved"];

export async function updateFeedbackStatusAdmin(id: string, status: string) {
  if (!ADVANCEABLE_STATUSES.includes(status)) {
    throw new FeedbackValidationError("Invalid status");
  }
  const feedback = await FeedbackModel.findById(id);
  if (!feedback) return null;
  feedback.status = status as (typeof ADVANCEABLE_STATUSES)[number] as typeof feedback.status;
  await feedback.save();
  return feedback;
}

export async function respondToFeedbackAdmin(id: string, adminResponse: string) {
  const feedback = await FeedbackModel.findById(id);
  if (!feedback) return null;
  feedback.adminResponse = adminResponse;
  feedback.respondedAt = new Date();
  await feedback.save();
  return feedback;
}
