export const ADD_ON_PRICES: Record<string, number> = {
  "whipped-cream": 30,
  "extra-chocolate-syrup": 25,
  "oreo-crumbs": 35,
  "kitkat-crumbs": 40,
  "dry-fruits": 45,
};

export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_FEE = 39;

export const WEBSITE_DISCOUNT_PCT = 0.1;
export const TAX_PCT = 0.05;

export const PUNCH_CARD_THRESHOLD = 5;
export const PUNCH_CARD_DISCOUNT_PCT = 0.5;

export const LOYALTY_PERCENT_BY_TIER = {
  "first-order": 0.1,
  returning: 0.15,
  gold: 0.2,
} as const;

export const RECOMMENDATION_LIMIT = 3;
