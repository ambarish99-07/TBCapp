export type RootStackParamList = {
  Menu: undefined;
  Addresses: undefined;
  // Optional prefill from "use current location" or tapping a Patna address search result.
  AddAddress: { address?: string; area?: string; city?: string; pincode?: string } | undefined;
  ItemDetail: { menuItemId: string };
  Combos: undefined;
  ChooseCombo: { comboId: string };
  BulkOrder: undefined;
  Cart: undefined;
  Checkout: undefined;
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
