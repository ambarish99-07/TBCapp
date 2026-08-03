export type LoyaltyTier = "first-order" | "returning" | "gold" | null;

export interface CartLineInput {
  /** Server-resolved unit price. Callers must never pass a client-submitted value here. */
  unitPrice: number;
  addOnPrices: number[];
  quantity: number;
  /** True for synthetic "choose N" combo lines — these never qualify for the punch-card discount. */
  isCombo: boolean;
}

export interface PunchCardState {
  ordersSinceReward: number;
}

export interface PricingInput {
  lines: CartLineInput[];
  isLoggedIn: boolean;
  tier: LoyaltyTier;
  punchCard: PunchCardState;
}

export interface PricingResult {
  subtotal: number;
  punchCardDiscount: number;
  websiteDiscountAmount: number;
  loyaltyDiscountAmount: number;
  bestPercentDiscount: number;
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
