export type RootStackParamList = {
  BrandSelect: undefined;
  Menu: undefined;
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
};
