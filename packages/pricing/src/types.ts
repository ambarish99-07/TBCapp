export type DrinkCategory = "signature-shakes" | "cold-coffee";

export interface CartLineInput {
  /** Server-resolved unit price (post item-level sale price, if any). Callers must never pass a client-submitted value here. */
  unitPrice: number;
  addOnPrices: number[];
  quantity: number;
  /** True for synthetic "choose N" combo lines — these never qualify for the quantity-tier discount or milestone rewards, and keep their own flat bundle price. */
  isCombo: boolean;
  /** Required for non-combo lines — drives the 6th-order (cold coffee) and 10th-order (any drink) milestone rewards. Combo lines may omit it. */
  category?: DrinkCategory;
}

export interface LoyaltyState {
  /** Total completed orders before this one. Order-count-derived milestones and premium status are computed from this. */
  completedOrderCount: number;
  /** Admin-settable override — grants premium status regardless of completedOrderCount. */
  isPremiumMemberOverride: boolean;
}

export interface PricingInput {
  lines: CartLineInput[];
  isLoggedIn: boolean;
  loyalty: LoyaltyState;
  /**
   * Customer-entered distance from the shop, in km — a placeholder for real
   * geolocation (see project memory). Only affects delivery fee for premium
   * members; null/undefined means "unknown", never treated as in-range.
   */
  distanceFromShopKm?: number | null;
  /**
   * Resolved (already time-checked by the caller) flag for a purchased, active
   * Premium Membership — independent of `loyalty`/`isPremiumMember`. Waives the
   * delivery fee outright, regardless of distance or subtotal, but never affects
   * the quantity-tier/premium discount.
   */
  hasFreeDeliveryMembership?: boolean;
  /**
   * Whether this order's brand is one of the "quick delivery" brands (TBC, Alchemy Tails) that
   * the first/second-order new-customer offer applies to — GG Tiffin is deliberately excluded.
   * Resolved by the caller from the order's brandId (see @tbc/shared-types QUICK_DELIVERY_BRAND_IDS),
   * not decided inside this brand-agnostic pricing engine. Defaults to false when omitted, so
   * existing callers that don't pass it never accidentally grant the offer.
   */
  isQuickDeliveryBrand?: boolean;
}

export type DiscountReason = "none" | "quantity-tier" | "premium" | "first-order-bogo" | "second-order-half-off";

export interface PricingResult {
  subtotal: number;
  /** Whether this order is being priced as a premium member (15+ completed orders, or admin override). */
  isPremiumMember: boolean;
  /** The quantity-tier (0/10/15/20%), premium (25%), or new-customer-offer (order #1 BOGO / order
   * #2 50% off) discount amount, applied to the non-combo subtotal only. */
  discountAmount: number;
  discountReason: DiscountReason;
  /** The 6th/16th/26th... (50% off a cold coffee) or 10th/20th/30th... (one drink free) milestone reward amount, if this order qualifies. */
  rewardAmount: number;
  rewardReason: "none" | "sixth-order-cold-coffee" | "tenth-order-free-drink";
  /** Whether the delivery fee was waived because of a purchased Premium Membership (not the loyalty-tier free-delivery radius). */
  hasFreeDeliveryMembership: boolean;
  deliveryFee: number;
  tax: number;
  total: number;
}

/** Minimal shape recommendation scoring needs — deliberately not the full MenuItem DTO. */
export interface PairableItem {
  id: string;
  pairsWith?: string[];
}

export interface ScoredItem {
  menuItemId: string;
  score: number;
}
