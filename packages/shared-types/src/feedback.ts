import { z } from "zod";

export const FeedbackTypeSchema = z.enum(["review", "complaint"]);
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;

export const FeedbackCategorySchema = z.enum(["wrong-item", "missing-item", "late-delivery", "quality-issue", "other"]);
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;
export const FEEDBACK_CATEGORIES = FeedbackCategorySchema.options;

export const FeedbackStatusSchema = z.enum(["open", "in-progress", "resolved"]);
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;
export const FEEDBACK_STATUSES = FeedbackStatusSchema.options;

/**
 * What a customer submits — one form covers both a star-rating review and an issue report,
 * rather than making the customer pick "review" vs. "complaint" up front. `isComplaint` is the
 * one signal that decides which the record becomes: true requires a `category`; false requires a
 * `rating`. `message` (free text) is optional either way.
 */
export const SubmitFeedbackRequestSchema = z
  .object({
    isComplaint: z.boolean(),
    rating: z.number().int().min(1).max(5).optional(),
    category: FeedbackCategorySchema.optional(),
    message: z.string().max(1000).optional(),
  })
  .refine((data) => !data.isComplaint || !!data.category, { message: "A complaint needs a category", path: ["category"] })
  .refine((data) => data.isComplaint || data.rating != null, { message: "A review needs a star rating", path: ["rating"] });
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;

export const RespondToFeedbackRequestSchema = z.object({
  adminResponse: z.string().min(1).max(1000),
});
export type RespondToFeedbackRequest = z.infer<typeof RespondToFeedbackRequestSchema>;

export const FeedbackSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  brandId: z.string(),
  userId: z.string(),
  customerName: z.string(),
  type: FeedbackTypeSchema,
  rating: z.number().optional(),
  category: FeedbackCategorySchema.optional(),
  message: z.string().optional(),
  status: FeedbackStatusSchema,
  adminResponse: z.string().optional(),
  respondedAt: z.string().optional(),
  createdAt: z.string(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;
