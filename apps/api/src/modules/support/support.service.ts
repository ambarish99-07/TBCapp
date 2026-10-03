import { randomBytes } from "node:crypto";
import {
  MAX_SUPPORT_TICKETS_PER_DAY,
  type CreateSupportTicketRequest,
  type UpdateSupportTicketRequest,
} from "@tbc/shared-types";
import { isValidObjectId } from "mongoose";
import { OrderModel } from "../../db/models/Order.model.js";
import { SupportTicketModel } from "../../db/models/SupportTicket.model.js";
import { UserModel } from "../../db/models/User.model.js";

/** Well-formed but not acceptable (not your order, too many requests today, ...) → 400. */
export class SupportValidationError extends Error {}

function ticketNumber(): string {
  return `HLP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Only photos this API itself stored (POST /support/photo) — never an arbitrary external URL. */
export function isOwnSupportPhotoUrl(url: string): boolean {
  return /\/support-images\/[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(url);
}

export async function createSupportTicket(userId: string, request: CreateSupportTicketRequest) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await SupportTicketModel.countDocuments({ userId, createdAt: { $gte: since } });
  if (recent >= MAX_SUPPORT_TICKETS_PER_DAY) {
    throw new SupportValidationError("You've sent a lot of requests today — please call or WhatsApp us instead.");
  }
  if (request.photoUrl && !isOwnSupportPhotoUrl(request.photoUrl)) {
    throw new SupportValidationError("Please attach the photo again");
  }

  const user = await UserModel.findById(userId);
  if (!user) throw new SupportValidationError("Account not found");

  let order: { _id: unknown; orderNumber: string } | null = null;
  if (request.orderId) {
    if (!isValidObjectId(request.orderId)) throw new SupportValidationError("Order not found");
    order = await OrderModel.findOne({ _id: request.orderId, userId }, "orderNumber").lean();
    if (!order) throw new SupportValidationError("That order isn't on your account");
  }

  return SupportTicketModel.create({
    ticketNumber: ticketNumber(),
    userId,
    customerName: user.fullName,
    customerPhone: user.phone ?? undefined,
    orderId: order?._id,
    orderNumber: order?.orderNumber,
    topic: request.topic,
    message: request.message,
    photoUrl: request.photoUrl,
  });
}

export function listMySupportTickets(userId: string) {
  return SupportTicketModel.find({ userId }).sort({ createdAt: -1 }).limit(20);
}

export function listSupportTicketsAdmin(status?: string) {
  return SupportTicketModel.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200);
}

export async function updateSupportTicketAdmin(id: string, update: UpdateSupportTicketRequest) {
  if (!isValidObjectId(id)) throw new SupportValidationError("Help request not found");
  const set: Record<string, unknown> = {};
  if (update.status) set.status = update.status;
  if (update.adminReply !== undefined) {
    set.adminReply = update.adminReply;
    set.repliedAt = new Date();
    // Replying moves a fresh request along unless the admin explicitly chose a status.
    if (!update.status) set.status = "in-progress";
  }
  const ticket = await SupportTicketModel.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true });
  if (!ticket) throw new SupportValidationError("Help request not found");
  return ticket;
}
