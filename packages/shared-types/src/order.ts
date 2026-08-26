import { z } from "zod";
import { CreateOrderCartSchema, ResolvedCartLineSchema } from "./cart.js";

export const OrderStatusSchema = z.enum([
  "received",
  "preparing",
  "out-for-delivery",
  "delivered",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const PaymentMethodSchema = z.enum(["cod", "razorpay"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStatusSchema = z.enum(["pending", "paid", "failed", "refunded"]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const DiscountReasonSchema = z.enum(["none", "quantity-tier", "premium"]);
export const RewardReasonSchema = z.enum(["none", "sixth-order-cold-coffee", "tenth-order-free-drink"]);

/**
 * Who this order is being delivered to — always a contact/address, independent
 * of which account placed the order (see `Order.customer` for the account
 * owner's own identity). Used both inline on an order and for saved recipients.
 */
export const DeliveryDetailsSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1),
  houseNumber: z.string().optional(),
  area: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(1),
  pincode: z.string().min(1),
  mapsLink: z.string().optional(),
  specialInstructions: z.string().optional(),
  /** Customer-entered placeholder for real geolocation — only affects pricing for premium members. */
  distanceFromShopKm: z.number().nonnegative().optional(),
});
export type DeliveryDetails = z.infer<typeof DeliveryDetailsSchema>;

/** Snapshot of the logged-in account that placed the order — distinct from `delivery`, which is who receives it. */
export const OrderCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
});
export type OrderCustomer = z.infer<typeof OrderCustomerSchema>;

export const DeliveryForSchema = z.enum(["self", "recipient"]);
export type DeliveryFor = z.infer<typeof DeliveryForSchema>;

export const OrderTotalsSchema = z.object({
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  discountReason: DiscountReasonSchema,
  rewardAmount: z.number().nonnegative(),
  rewardReason: RewardReasonSchema,
  /** Set only when a coupon was applied and actually deducted something — absent/0 otherwise. */
  couponCode: z.string().optional(),
  couponDiscountAmount: z.number().nonnegative(),
  deliveryFee: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
});
export type OrderTotals = z.infer<typeof OrderTotalsSchema>;

export const PaymentInfoSchema = z.object({
  method: PaymentMethodSchema,
  status: PaymentStatusSchema,
  razorpayOrderId: z.string().optional(),
  razorpayPaymentId: z.string().optional(),
  refundAmount: z.number().min(0).optional(),
});
export type PaymentInfo = z.infer<typeof PaymentInfoSchema>;

export const StatusHistoryEntrySchema = z.object({
  status: OrderStatusSchema,
  at: z.string(), // ISO timestamp
  note: z.string().optional(),
});
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntrySchema>;

/** The rider handling this order — assigned once it moves to "out-for-delivery". There's no real
 * rider app/dispatch system in this project, so this is picked from a fixed demo pool rather than
 * live dispatch (see TiffinSingleMealOrder's own, separate DeliveryPartnerSchema — the two order
 * systems are kept independent, same reasoning as their other duplicated small schemas — hence
 * the "Order" prefix here to avoid colliding with that export). */
export const OrderDeliveryPartnerSchema = z.object({
  name: z.string(),
  phone: z.string(),
});
export type OrderDeliveryPartner = z.infer<typeof OrderDeliveryPartnerSchema>;

/**
 * Three-tier cancellation refund, keyed off the order's status at the moment it's cancelled:
 * still "received" (nothing started yet) → full refund; "preparing" or "out-for-delivery" (already
 * in progress or on the way) → ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT; "delivered" (a
 * post-delivery complaint — spilled, never arrived, etc.) → ORDER_CANCELLATION_DELIVERED_REFUND_PERCENT.
 * Only meaningful for an order actually paid via Razorpay already — COD never charged anything
 * upfront, so there's nothing to refund through the system regardless of tier.
 */
export const ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT = 0.5;
export const ORDER_CANCELLATION_DELIVERED_REFUND_PERCENT = 0.3;

export const CancelOrderRequestSchema = z.object({
  /** Why the customer is cancelling — most relevant for a post-delivery cancellation (spilled,
   * never arrived), optional otherwise. Shown to admins, never affects the refund tier itself. */
  reason: z.string().max(300).optional(),
});
export type CancelOrderRequest = z.infer<typeof CancelOrderRequestSchema>;

/** What the client POSTs to create an order — no prices, no totals, server derives everything. */
export const CreateOrderRequestSchema = z.object({
  items: CreateOrderCartSchema,
  brandId: z.string(),
  delivery: DeliveryDetailsSchema,
  /** Client's explicit intent — "self" prefills from the account but is still just delivery info; never inferred server-side. */
  deliveryFor: DeliveryForSchema,
  paymentMethod: PaymentMethodSchema,
  /** Re-validated server-side against the resolved cart — never trusted for the discount amount itself. */
  couponCode: z.string().optional(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

/** Full persisted/returned order shape. */
export const OrderSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  /** Separate unguessable token for guest order lookup — never the DB primary key. */
  accessToken: z.string(),
  orderNumber: z.string(),
  userId: z.string().nullable(),
  /** The account that placed and pays for the order — absent for guest orders. */
  customer: OrderCustomerSchema.optional(),
  deliveryFor: DeliveryForSchema,
  items: z.array(ResolvedCartLineSchema),
  delivery: DeliveryDetailsSchema,
  totals: OrderTotalsSchema,
  /** Snapshot at order time — a later premium-status change must never retroactively alter a past order's charge. */
  isPremiumMemberAtOrder: z.boolean(),
  estimatedMinutes: z.number().int().positive(),
  status: OrderStatusSchema,
  statusHistory: z.array(StatusHistoryEntrySchema),
  deliveryPartner: OrderDeliveryPartnerSchema.optional(),
  /** Set only when cancelled with a reason attached — see CancelOrderRequestSchema. */
  cancellationReason: z.string().optional(),
  payment: PaymentInfoSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;
