import { z } from "zod";

/**
 * Help requests raised from the in-app assistant (the guided support chat). Unlike Feedback —
 * one review/complaint per DELIVERED order — these cover live problems too: a payment that went
 * through with no confirmed order, an item missing from an order that just arrived, or a general
 * question. Each lands in the admin's "Help Requests" inbox; the admin's reply shows up in the
 * customer's chat under "My help requests".
 */
export const SupportTopicSchema = z.enum([
  "payment-not-confirmed",
  "missing-item",
  "wrong-item",
  "spilled-or-damaged",
  "quality-issue",
  "late-delivery",
  "other",
]);
export type SupportTopic = z.infer<typeof SupportTopicSchema>;

export const SUPPORT_TOPIC_LABELS: Record<SupportTopic, string> = {
  "payment-not-confirmed": "Payment taken, order not confirmed",
  "missing-item": "Item missing",
  "wrong-item": "Wrong item",
  "spilled-or-damaged": "Spilled / damaged",
  "quality-issue": "Food quality",
  "late-delivery": "Late delivery",
  other: "Something else",
};

export const SupportTicketStatusSchema = z.enum(["open", "in-progress", "resolved"]);
export type SupportTicketStatus = z.infer<typeof SupportTicketStatusSchema>;

export const CreateSupportTicketRequestSchema = z.object({
  topic: SupportTopicSchema,
  /** The customer's own order — optional (a general question has none), ownership checked server-side. */
  orderId: z.string().optional(),
  message: z.string().trim().min(3, "Tell us a little about what happened").max(1000),
  /** From POST /support/photo — only URLs that endpoint issued are accepted. */
  photoUrl: z.string().url().optional(),
});
export type CreateSupportTicketRequest = z.infer<typeof CreateSupportTicketRequestSchema>;

export const UpdateSupportTicketRequestSchema = z.object({
  status: SupportTicketStatusSchema.optional(),
  adminReply: z.string().trim().max(1000).optional(),
});
export type UpdateSupportTicketRequest = z.infer<typeof UpdateSupportTicketRequestSchema>;

export const SupportTicketSchema = z.object({
  id: z.string(),
  ticketNumber: z.string(),
  userId: z.string(),
  customerName: z.string(),
  customerPhone: z.string().optional(),
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  topic: SupportTopicSchema,
  message: z.string(),
  photoUrl: z.string().optional(),
  status: SupportTicketStatusSchema,
  adminReply: z.string().optional(),
  repliedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SupportTicket = z.infer<typeof SupportTicketSchema>;

/** Abuse guard — how many help requests one account can open per rolling 24 hours. */
export const MAX_SUPPORT_TICKETS_PER_DAY = 10;
