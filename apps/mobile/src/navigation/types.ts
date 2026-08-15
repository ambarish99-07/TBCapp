export type RootStackParamList = {
  Menu: undefined;
  // No params — reads the currently-selected brand from brandStore, same as Menu's old
  // in-page item list did before it moved here. Reachable via the Home page's Restaurants row.
  RestaurantMenu: undefined;
  Addresses: undefined;
  // Optional prefill from "use current location" or tapping a Patna address search result.
  AddAddress: { address?: string; area?: string; city?: string; pincode?: string } | undefined;
  Combos: undefined;
  ChooseCombo: { comboId: string };
  BulkOrder: undefined;
  // GG Tiffin's own flow — reached from the GG Tiffin brand tile instead of RestaurantMenu.
  TiffinLanding: undefined;
  // The real curated weekly menu, browsable by day — separate from any specific plan/order flow.
  TiffinWeeklyMenu: undefined;
  TiffinPlanSelect: { planId: string };
  TiffinCheckout: { planId: string; mealType?: "breakfast" | "lunch" | "dinner" };
  MyTiffin: undefined;
  // One-off "buy tomorrow's tiffin" purchase — no subscription commitment, separate from the
  // plan catalog above. Three tiers (Regular / Mini Meal / Premium) x two diet sections (Veg / Non-Veg).
  TiffinSingleMeal: undefined;
  TiffinSingleMealCheckout: {
    tier: "regular" | "mini" | "premium";
    mealType: "breakfast" | "lunch" | "dinner";
    dietType: "veg" | "non-veg";
    date: string;
    dishName: string;
    price: number;
    carbChoice?: "rice" | "roti";
  };
  // ₹39/30-day free-delivery membership — reached from the Home carousel's promo card.
  PremiumMembership: undefined;
  Cart: undefined;
  // Now an "update my saved address" screen (profile PATCH), not an order-placement form —
  // Cart itself places the order once the account has a complete saved address.
  Checkout: undefined;
  // hideCod: monthly tiffin plans can't be paid Cash on Delivery — Cart's call (no params) still
  // shows every option as before.
  PaymentMethod: { hideCod?: boolean } | undefined;
  // accessToken, not orderId — this is a public, unauthenticated lookup so it
  // works right after checkout for guests, not just logged-in owners.
  OrderStatus: { accessToken: string };
  GuestLookup: undefined;
  Login: undefined;
  Account: undefined;
  OrderHistory: undefined;
  EditProfile: undefined;
  Search: undefined;
  // Either a fixed browse category (categoryId) or a free-text query — CategoryResultsScreen
  // handles both through the same cross-brand search endpoint.
  CategoryResults: { label: string; categoryId?: string; query?: string };
};
