export const ADD_ON_PRICES: Record<string, number> = {
  "whipped-cream": 30,
  "extra-chocolate-syrup": 25,
  "oreo-crumbs": 35,
  "kitkat-crumbs": 40,
  "dry-fruits": 45,
  "extra-mint": 15,
  "lemon-wedge": 10,
  "chilli-salt-rim": 20,
  "extra-fizz": 20,
  "fruit-garnish": 25,
};

export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_FEE = 39;
export const TAX_PCT = 0.05;

/** Quantity-tier discount on the non-combo subtotal: 1 item -> 0%, 2 -> 10%, 3 -> 15%, 4+ -> 20%. */
export const QUANTITY_DISCOUNT_TIERS: { minQuantity: number; percent: number }[] = [
  { minQuantity: 4, percent: 0.2 },
  { minQuantity: 3, percent: 0.15 },
  { minQuantity: 2, percent: 0.1 },
  { minQuantity: 0, percent: 0 },
];

/** Premium members always get this flat discount instead of the quantity tier — better than the tier's 20% max. */
export const PREMIUM_DISCOUNT_PCT = 0.25;
/** Completed orders required to unlock premium membership (in addition to any admin override). */
export const PREMIUM_ORDER_THRESHOLD = 15;

/** Every 10th-cycle order at position 6 (6, 16, 26, ...): 50% off the cheapest cold-coffee unit in the cart. */
export const SIXTH_ORDER_CYCLE_POSITION = 6;
export const SIXTH_ORDER_REWARD_PCT = 0.5;
/** Every 10th-cycle order at position 0 (10, 20, 30, ...): the cheapest eligible drink unit is entirely free. */
export const TENTH_ORDER_CYCLE_POSITION = 0;
export const REWARD_CYCLE_LENGTH = 10;

/** Placeholder radius check for premium free delivery — see project memory re: real geolocation. */
export const FREE_DELIVERY_RADIUS_KM = 4;

/** Every combo (curated or choose-your-own) is priced at this flat discount off the sum of its constituent shakes' base prices — computed live, never a stored/stale number. */
export const COMBO_DISCOUNT_PCT = 0.15;

export const RECOMMENDATION_LIMIT = 3;
