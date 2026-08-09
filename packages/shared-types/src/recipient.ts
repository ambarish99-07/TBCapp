import { z } from "zod";
import { DeliveryDetailsSchema } from "./order.js";

/**
 * A customer's saved delivery contact (e.g. "Home", "Mom") — reuses the exact
 * same shape an order's `delivery` field has, since a saved recipient is
 * nothing more than delivery details the customer wants to reuse later.
 */
export const SavedRecipientSchema = DeliveryDetailsSchema.extend({
  id: z.string(),
  label: z.string().min(1),
});
export type SavedRecipient = z.infer<typeof SavedRecipientSchema>;

export const SaveRecipientRequestSchema = DeliveryDetailsSchema.extend({
  label: z.string().min(1),
});
export type SaveRecipientRequest = z.infer<typeof SaveRecipientRequestSchema>;
