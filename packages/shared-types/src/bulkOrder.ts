import { z } from "zod";

export const BulkOrderInquiryStatusSchema = z.enum(["new", "contacted", "closed"]);
export type BulkOrderInquiryStatus = z.infer<typeof BulkOrderInquiryStatusSchema>;

/** What the customer submits from the bulk-order contact form — only name/phone are required. */
export const CreateBulkOrderInquiryRequestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  occasion: z.string().optional(),
  estimatedQuantity: z.string().optional(),
  preferredDate: z.string().optional(),
  message: z.string().optional(),
});
export type CreateBulkOrderInquiryRequest = z.infer<typeof CreateBulkOrderInquiryRequestSchema>;

export const BulkOrderInquirySchema = CreateBulkOrderInquiryRequestSchema.extend({
  id: z.string(),
  status: BulkOrderInquiryStatusSchema,
  createdAt: z.string(),
});
export type BulkOrderInquiry = z.infer<typeof BulkOrderInquirySchema>;
