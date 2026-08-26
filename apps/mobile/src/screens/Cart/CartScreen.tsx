import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CROSS_BRAND_ID, isQuickDeliveryBrandId, type MenuItem } from "@tbc/shared-types";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchMe } from "../../api/auth.api";
import { useBrands } from "../../api/brands.api";
import { useAllMenuItems, useMenuItems } from "../../api/menu.api";
import { createOrderRequest } from "../../api/orders.api";
import { createRazorpayOrderRequest, verifyRazorpayPaymentRequest } from "../../api/payments.api";
import { AddItemModal } from "../../components/AddItemModal";
import { EditCartItemModal } from "../../components/EditCartItemModal";
import { CARD_WIDTH, ItemMiniCard } from "../../components/HomeCollections";
import { PriceBreakdown } from "../../components/PriceBreakdown";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useBrandStore } from "../../state/brandStore";
import { useCartStore, type CartLine } from "../../state/cartStore";
import { usePaymentMethodStore } from "../../state/paymentMethodStore";
import { useTheme } from "../../state/themeStore";
import { useAuthContext } from "../../state/useAuthContext";
import { hasCompleteAddress } from "../../utils/profile";
import { launchRazorpayCheckoutPlaceholder } from "../../utils/razorpayPlaceholder";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Cart">;

const ORDER_PLACED_DURATION_MS = 1700;
const SUGGESTIONS_PER_PAGE = 3;

export function CartScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const computeTotals = useCartStore((state) => state.computeTotals);
  const clearCart = useCartStore((state) => state.clear);
  const appliedCoupon = useCartStore((state) => state.appliedCoupon);
  const setAppliedCoupon = useCartStore((state) => state.setAppliedCoupon);
  const auth = useAuthContext();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const { data: menuItems } = useMenuItems();
  // Cross-brand, not scoped to whichever brand happens to be ambiently selected right now (the
  // Home carousel auto-rotates that independently of the cart — see orders.api.ts's
  // resolveCartBrandId for the same drift concern) — filtered down to the cart's own brand below.
  const { data: allMenuItems } = useAllMenuItems();
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [addingItem, setAddingItem] = useState<MenuItem | null>(null);
  const [suggestionPage, setSuggestionPage] = useState(0);
  const editingMenuItem = editingLine ? menuItems?.find((item) => item.id === editingLine.menuItemId) : null;
  const editingCategory = editingMenuItem?.category ?? null;
  const selectedPaymentOption = usePaymentMethodStore((state) => state.selected);
  const { data: brands } = useBrands();
  const restoreBrand = useBrandStore((state) => state.restoreBrand);
  const [submitting, setSubmitting] = useState(false);
  // Set the instant the order succeeds — triggers the full-screen "Order Placed" confirmation
  // below, which then clears the cart and navigates on once it's done, same pattern as the
  // Account screen's full-screen "<Mode> Activated" confirmation.
  const [placedAccessToken, setPlacedAccessToken] = useState<string | null>(null);
  const thumbScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!placedAccessToken) return;
    thumbScale.setValue(0);
    Animated.spring(thumbScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      clearCart();
      navigation.replace("OrderStatus", { accessToken: placedAccessToken });
    }, ORDER_PLACED_DURATION_MS);
    return () => clearTimeout(timer);
  }, [placedAccessToken, thumbScale, clearCart, navigation]);

  const profileComplete = hasCompleteAddress(user);
  const canProceed = profileComplete && !!selectedPaymentOption;

  // BOGO (order #1) needs 2+ non-combo units to have anything to give away for free — computePricing
  // silently returns no discount below that, same as it would at checkout. This nudge is the only
  // place that explains *why*, before the customer reaches the payment screen and wonders where
  // the offer they saw on Home went.
  const nonComboUnits = lines.filter((line) => !line.isCombo).reduce((sum, line) => sum + line.quantity, 0);
  const ownedLine = lines.find((line) => line.brandId && line.brandId !== CROSS_BRAND_ID);
  const isQuickDeliveryBrand = ownedLine ? isQuickDeliveryBrandId(ownedLine.brandId) : false;
  const nextOrderNumber = auth.loyalty.completedOrderCount + 1;
  const showBogoNudge = auth.isLoggedIn && isQuickDeliveryBrand && nextOrderNumber === 1 && nonComboUnits === 1;
  // 50% off (order #2) has no minimum-quantity gate — it applies to whatever's already in the
  // cart, so this is purely a heads-up, not a "you're about to miss it" warning like BOGO's.
  const showHalfOffNudge = auth.isLoggedIn && isQuickDeliveryBrand && nextOrderNumber === 2 && lines.length > 0;
  const cartBrand = brands?.find((brand) => brand.id === ownedLine?.brandId);

  // restoreBrand, not selectBrand — selectBrand clears the cart on every switch (it assumes a
  // deliberate brand change), which would wipe the very items this nudge exists to add to.
  function handleBrowseCartBrandMenu() {
    if (cartBrand) restoreBrand(cartBrand);
    navigation.navigate("RestaurantMenu");
  }

  // Proactively surfaces the offer the moment the cart becomes eligible, rather than only when
  // the customer scrolls past the banner or reaches checkout — a popup they have to dismiss is
  // much harder to miss than a banner they can scroll past. Fires once per eligible cart (the ref
  // resets once they're no longer eligible — e.g. they added a 2nd item — so it can fire again if
  // they remove back down to 1).
  const bogoPopupShownRef = useRef(false);
  useEffect(() => {
    // placedAccessToken means an order just succeeded — completedOrderCount (and therefore
    // nextOrderNumber) updates the instant that happens, while this screen is still mounted for
    // its "Order Placed" confirmation and hasn't cleared/navigated away yet. Without this guard,
    // that brief window could fire a popup describing eligibility for the *next* order right on
    // top of the confirmation for the one that just finished — confusing regardless of which
    // offer it is.
    if (!showBogoNudge || placedAccessToken) {
      bogoPopupShownRef.current = false;
      return;
    }
    if (bogoPopupShownRef.current) return;
    bogoPopupShownRef.current = true;
    // Just an acknowledgement, not a navigation prompt — the customer is already on the Cart
    // screen, which already has both the "Tap here to browse the menu" nudge banner and its own
    // "+ Add More Items" button right there, so this popup's job is only to make sure they don't
    // miss the offer, not to send them anywhere.
    Alert.alert(
      "🎁 You're eligible for Buy 1 Get 1 Free!",
      "Add one more item from the menu and get it free — this offer is only available on your first order."
    );
  }, [showBogoNudge, placedAccessToken]);

  // Same proactive treatment for the 2nd-order offer — nothing to add, just a heads-up that it's
  // already been applied so the discount on the total below doesn't come as a surprise.
  const halfOffPopupShownRef = useRef(false);
  useEffect(() => {
    // See the comment on the BOGO effect above — same guard, same reason.
    if (!showHalfOffNudge || placedAccessToken) {
      halfOffPopupShownRef.current = false;
      return;
    }
    if (halfOffPopupShownRef.current) return;
    halfOffPopupShownRef.current = true;
    Alert.alert("🔥 50% Off Applied!", "This is your 2nd order — 50% off is already applied to your total below.");
  }, [showHalfOffNudge, placedAccessToken]);

  if (lines.length === 0 && !placedAccessToken) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Your cart is empty.</Text>
        <Pressable style={styles.browseButton} onPress={() => navigation.navigate("Menu")}>
          <Text style={styles.browseButtonText}>Browse the menu</Text>
        </Pressable>
      </View>
    );
  }

  const result = computeTotals(auth);

  function handleRemoveCoupon() {
    if (!appliedCoupon) return;
    Alert.alert("Remove coupon?", `${appliedCoupon.code} will no longer be applied to this order.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setAppliedCoupon(null) },
    ]);
  }

  // A quick "add more from this cart" nudge, right where the customer already is instead of
  // making them leave and come back — every item from the cart's own brand not already in it,
  // paged 3 at a time (see suggestionPage below) rather than a hard cap, so the whole menu stays
  // reachable from here.
  const allSuggestedItems = (allMenuItems ?? []).filter(
    (item) => item.brandId === ownedLine?.brandId && !lines.some((line) => line.menuItemId === item.id)
  );
  const suggestionPageCount = Math.ceil(allSuggestedItems.length / SUGGESTIONS_PER_PAGE);
  // Clamped rather than reset via an effect — cheaper, and self-corrects the instant an item
  // that was on a later page gets added to the cart and the list shrinks out from under it.
  const clampedSuggestionPage = Math.min(suggestionPage, Math.max(0, suggestionPageCount - 1));
  const suggestedItems = allSuggestedItems.slice(
    clampedSuggestionPage * SUGGESTIONS_PER_PAGE,
    clampedSuggestionPage * SUGGESTIONS_PER_PAGE + SUGGESTIONS_PER_PAGE
  );

  // Catches the exact "missed the nudge" moment — the customer is about to pay for a single item
  // that would've been free as part of a BOGO pair, with no chance left to add a second one after
  // this screen. A banner they can scroll past is easy to miss; a popup right at the point of
  // paying isn't.
  function handleProceedToPay() {
    if (!profileComplete || !selectedPaymentOption || !user) return;

    if (showBogoNudge) {
      Alert.alert(
        "You're eligible for Buy 1 Get 1 Free!",
        "Add one more item to get it free — or continue and pay full price for this order.",
        [
          { text: "Add One More Item", onPress: handleBrowseCartBrandMenu },
          { text: "Continue Anyway", style: "destructive", onPress: submitOrder },
        ]
      );
      return;
    }

    submitOrder();
  }

  async function submitOrder() {
    if (!profileComplete || !selectedPaymentOption || !user) return;

    setSubmitting(true);
    try {
      const order = await createOrderRequest({
        items: lines.map((line) => ({
          lineId: line.lineId,
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          customization: { sugarLevel: line.sugarLevel, iceLevel: line.iceLevel, addOnIds: line.addOnIds, comment: line.comment },
        })),
        delivery: {
          fullName: user.fullName,
          phone: user.phone!,
          address: user.address!,
          houseNumber: user.houseNumber,
          area: user.area,
          landmark: user.landmark,
          city: user.city!,
          pincode: user.pincode!,
        },
        deliveryFor: "self",
        paymentMethod: selectedPaymentOption.apiMethod,
        couponCode: appliedCoupon?.code,
      });

      if (selectedPaymentOption.apiMethod === "razorpay") {
        const razorpayOrder = await createRazorpayOrderRequest(order.id, order.accessToken);
        const paymentResult = await launchRazorpayCheckoutPlaceholder(razorpayOrder);
        if (paymentResult) {
          await verifyRazorpayPaymentRequest({
            orderId: order.id,
            accessToken: order.accessToken,
            razorpay_order_id: razorpayOrder.razorpayOrderId,
            razorpay_payment_id: paymentResult.razorpay_payment_id,
            razorpay_signature: paymentResult.razorpay_signature,
          });
        }
      }

      // The server just advanced loyalty.completedOrderCount (COD: at creation above; Razorpay:
      // in the verify call just above) — refetch so the Home offer tabs and this cart's own BOGO
      // nudge reflect the new next-order-number immediately, not just after an app restart.
      // Best-effort: a failed refresh shouldn't block the "order placed" confirmation the
      // customer is actually waiting on.
      try {
        updateUser(await fetchMe());
      } catch {
        // Stale until next hydrate — not worth surfacing an error for.
      }

      // Payment method deliberately stays selected — it carries over to the next order
      // rather than resetting, same as the saved address. Cart clears once the "Order
      // Placed" confirmation below finishes, not immediately — see the effect above.
      setPlacedAccessToken(order.accessToken);
    } catch (err) {
      Alert.alert("Couldn't place order", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      {/* Everything scrolls together now (cart lines, suggestions, breakdown) — only the
          pay-using/checkout row stays pinned below, so it's never pushed off-screen by a long
          cart or the suggestions list, unlike the old fixed-height layout. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {lines.map((line) => (
          <View key={line.lineId} style={styles.line}>
            <View style={styles.lineTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{line.signatureName}</Text>
                {line.isCombo && line.commonName && <Text style={styles.lineCombo}>{line.commonName}</Text>}
                <Text style={styles.lineMeta}>
                  Sugar: {line.sugarLevel} · Ice: {line.iceLevel}
                  {line.addOnIds.length > 0 ? ` · ${line.addOnIds.length} add-on(s)` : ""}
                </Text>
                {line.comment && <Text style={styles.lineComment}>"{line.comment}"</Text>}
              </View>
              <Text style={styles.lineTotal}>₹{(line.unitPrice + line.addOnPrices.reduce((s, p) => s + p, 0)) * line.quantity}</Text>
            </View>
            {/* Same row as qty/Remove so Customize lines up exactly with Remove, right above the border. */}
            <View style={styles.lineBottomRow}>
              <View style={styles.qtyRow}>
                <Pressable onPress={() => setQuantity(line.lineId, line.quantity - 1)} style={styles.qtyButton}>
                  <Text style={styles.qtyButtonText}>-</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <Pressable onPress={() => setQuantity(line.lineId, line.quantity + 1)} style={styles.qtyButton}>
                  <Text style={styles.qtyButtonText}>+</Text>
                </Pressable>
                <Pressable onPress={() => removeLine(line.lineId)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
              {!line.isCombo && (
                <Pressable onPress={() => setEditingLine(line)}>
                  <Text style={styles.customize}>Customize</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}

        {/* Straight to the brand already in this cart (same restoreBrand-not-selectBrand navigation
            the BOGO nudge uses), not the generic Home screen — landing on Home would've meant
            re-picking the same restaurant just to add one more thing. */}
        <Pressable style={styles.addMoreButton} onPress={handleBrowseCartBrandMenu}>
          <Text style={styles.addMoreButtonText}>+ Add More Items</Text>
        </Pressable>

        {/* The popup on arrival already told them this and how to act on it — this banner is now
            just a lightweight, still-tappable reminder while they're on the page, not the primary
            notice, so it no longer repeats the "tap here" call to action. */}
        {showBogoNudge && (
          <Pressable style={styles.bogoNudge} onPress={handleBrowseCartBrandMenu}>
            <Text style={styles.bogoNudgeText}>
              🎁 Your order is eligible for Buy 1 Get 1 Free! Choose one more item from the menu to claim it.
            </Text>
          </Pressable>
        )}

        {/* Right where the customer already is — a one-tap way to hit the BOGO/quantity-tier
            minimums without leaving the cart to go browse. Same ItemMiniCard Home itself uses for
            "Recommended For You", so the photos read the same rounded-square style everywhere. The
            whole brand's menu is reachable here, 3 at a time — a Netflix/Hotstar-style arrow pages
            to the next 3 instead of capping the list or making it one long scroll. */}
        {allSuggestedItems.length > 0 && (
          <View style={styles.suggestionsWrap}>
            <Text style={styles.suggestionsTitle}>Add More From {cartBrand?.name ?? "This Menu"}</Text>
            {/* Arrows float on top of the cards (transparent, no background chip) instead of
                taking their own layout width — that was pushing the 3rd card further out of view
                and under the button than it needed to be. The cards row gets the full width now;
                the sliver an arrow visually sits over is still tappable through to the card behind
                it wherever the arrow's own glyph doesn't cover it. */}
            <View style={styles.suggestionsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsCards}>
                {suggestedItems.map((item) => (
                  <ItemMiniCard key={item.id} item={item} onPress={() => setAddingItem(item)} />
                ))}
              </ScrollView>
              {suggestionPageCount > 1 && clampedSuggestionPage > 0 && (
                <Pressable
                  style={[styles.suggestionsArrow, styles.suggestionsArrowLeft]}
                  onPress={() => setSuggestionPage((page) => Math.max(0, page - 1))}
                >
                  <Text style={styles.suggestionsArrowText}>‹</Text>
                </Pressable>
              )}
              {suggestionPageCount > 1 && clampedSuggestionPage < suggestionPageCount - 1 && (
                <Pressable
                  style={[styles.suggestionsArrow, styles.suggestionsArrowRight]}
                  onPress={() => setSuggestionPage((page) => Math.min(suggestionPageCount - 1, page + 1))}
                >
                  <Text style={styles.suggestionsArrowText}>›</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        <Pressable style={styles.couponCard} onPress={() => navigation.navigate("Coupons")}>
          <Text style={styles.couponRowLabel}>Apply Coupon</Text>
          <Text style={styles.couponRowChevron}>›</Text>
        </Pressable>
        {appliedCoupon && (
          <Pressable style={styles.couponAppliedRow} onPress={handleRemoveCoupon}>
            <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
            <Text style={styles.couponAppliedBadge}>Applied ✓</Text>
          </Pressable>
        )}

        <PriceBreakdown result={result} couponCode={appliedCoupon?.code} />
      </ScrollView>

      {/* Static, not scrollable — pinned directly above the payment row instead of living inside
          the scrolling content, where a longer cart or the suggestions row could push it out of
          view entirely, leaving customers staring at a disabled "Proceed to Pay" with no visible
          explanation why. This is the one thing standing between them and checking out, so it
          stays exactly where they're about to look. */}
      {!profileComplete && (
        <Pressable style={styles.completeProfileBanner} onPress={() => navigation.navigate("Checkout")}>
          <LinearGradient colors={["#3A2E22", "#181310"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.completeProfileGradient}>
            <View pointerEvents="none" style={styles.completeProfileGloss} />
            <Text style={styles.completeProfileText}>One-time setup - Save your profile!</Text>
          </LinearGradient>
        </Pressable>
      )}

      <View style={styles.actionRow}>
        <Pressable style={styles.payUsingBox} onPress={() => navigation.navigate("PaymentMethod")}>
          <Text style={styles.payUsingLabel}>Pay using</Text>
          <View style={styles.payUsingValueRow}>
            <Text style={styles.payUsingValue} numberOfLines={1}>
              {selectedPaymentOption?.label ?? "Select"}
            </Text>
            <Text style={styles.payUsingTriangle}>▾</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.checkoutButton, !canProceed && styles.checkoutButtonDisabled]}
          onPress={handleProceedToPay}
          disabled={!canProceed || submitting}
        >
          <Text style={styles.checkoutButtonText}>{submitting ? "Placing order…" : "Proceed to Pay"}</Text>
        </Pressable>
      </View>

      <EditCartItemModal
        line={editingLine}
        category={editingCategory}
        description={editingMenuItem?.description}
        onClose={() => setEditingLine(null)}
      />

      <AddItemModal item={addingItem} onClose={() => setAddingItem(null)} />

      {/* Full-screen "Order Placed" confirmation, same treatment as the Account screen's
          "<Mode> Activated" — sits on top until the effect above clears the cart and moves on. */}
      {placedAccessToken && (
        <View style={[styles.orderPlacedOverlay, { backgroundColor: colors.background }]}>
          <Animated.View style={{ transform: [{ scale: thumbScale }], alignItems: "center" }}>
            <Text style={styles.orderPlacedEmoji}>👍</Text>
            <Text style={styles.orderPlacedText}>Order Placed</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: theme.spacing(2), paddingBottom: theme.spacing(2) },
    bogoNudge: {
      backgroundColor: colors.accent + "22",
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1.5),
    },
    bogoNudgeText: { color: colors.primary, fontWeight: "700", fontSize: 13, textAlign: "center" },
    suggestionsWrap: { marginBottom: theme.spacing(2) },
    suggestionsTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    suggestionsRow: { position: "relative" },
    suggestionsCards: { flexDirection: "row", gap: theme.spacing(1.5) },
    // Transparent, no background chip — floats over the card's photo instead of claiming its own
    // layout width, so the card underneath stays fully visible (and still tappable outside the
    // small glyph itself) rather than being squeezed narrower to make room for an opaque button.
    suggestionsArrow: {
      position: "absolute",
      top: 0,
      height: CARD_WIDTH,
      width: 52,
      alignItems: "center",
      justifyContent: "center",
    },
    suggestionsArrowLeft: { left: 0 },
    suggestionsArrowRight: { right: 0 },
    suggestionsArrowText: {
      fontSize: 40,
      fontWeight: "800",
      color: "#fff",
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.background },
    emptyText: { color: colors.muted },
    browseButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingHorizontal: 20, paddingVertical: 10 },
    browseButtonText: { color: "#fff", fontWeight: "700" },
    couponCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1.25),
      marginBottom: theme.spacing(1),
    },
    couponRowLabel: { color: colors.text, fontWeight: "700", fontSize: 14 },
    couponRowChevron: { color: colors.muted, fontSize: 18, fontWeight: "700" },
    couponAppliedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primary + "14",
      borderRadius: theme.radius,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1.25),
      marginBottom: theme.spacing(1.5),
    },
    couponAppliedCode: { color: colors.primary, fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
    couponAppliedBadge: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    line: { paddingVertical: theme.spacing(1.5), borderBottomWidth: 1, borderBottomColor: colors.border },
    lineTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    lineName: { fontSize: 15, fontWeight: "700", color: colors.text },
    lineMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
    lineCombo: { fontSize: 12, color: colors.primary, fontWeight: "600", marginTop: 2 },
    lineComment: { fontSize: 11, color: colors.text, fontStyle: "italic", marginTop: 2 },
    lineBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    qtyButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    qtyButtonText: { color: colors.text },
    qtyValue: { fontWeight: "700", color: colors.text },
    remove: { color: colors.danger, fontSize: 12, marginLeft: 8 },
    lineTotal: { fontWeight: "700", color: colors.text },
    customize: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    addMoreButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      alignItems: "center",
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    addMoreButtonText: { color: colors.primary, fontWeight: "700" },
    completeProfileBanner: {
      borderRadius: theme.radius,
      marginHorizontal: theme.spacing(2),
      marginTop: theme.spacing(1),
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    completeProfileGradient: {
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(1.5),
      position: "relative",
    },
    completeProfileGloss: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "50%",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    completeProfileText: { fontSize: 13, fontWeight: "800", color: "#fff", textAlign: "center" },
    actionRow: {
      flexDirection: "row",
      gap: theme.spacing(1),
      padding: theme.spacing(2),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    payUsingBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      justifyContent: "center",
    },
    payUsingLabel: { fontSize: 12, fontWeight: "700", color: colors.text },
    payUsingValueRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    payUsingValue: { flexShrink: 1, fontSize: 13, color: colors.muted },
    payUsingTriangle: { fontSize: 12, color: colors.muted },
    checkoutButton: { flex: 1, backgroundColor: colors.primary, borderRadius: theme.radius, alignItems: "center", justifyContent: "center" },
    checkoutButtonDisabled: { opacity: 0.4 },
    checkoutButtonText: { color: "#fff", fontWeight: "700" },
    orderPlacedOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    orderPlacedEmoji: { fontSize: 72, marginBottom: theme.spacing(1.5) },
    orderPlacedText: { fontSize: 24, fontWeight: "800", color: colors.primary },
  });
