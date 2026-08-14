import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMenuItems } from "../../api/menu.api";
import { createOrderRequest } from "../../api/orders.api";
import { createRazorpayOrderRequest, verifyRazorpayPaymentRequest } from "../../api/payments.api";
import { EditCartItemModal } from "../../components/EditCartItemModal";
import { PriceBreakdown } from "../../components/PriceBreakdown";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useCartStore, type CartLine } from "../../state/cartStore";
import { usePaymentMethodStore } from "../../state/paymentMethodStore";
import { useTheme } from "../../state/themeStore";
import { useAuthContext } from "../../state/useAuthContext";
import { hasCompleteAddress } from "../../utils/profile";
import { launchRazorpayCheckoutPlaceholder } from "../../utils/razorpayPlaceholder";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Cart">;

const ORDER_PLACED_DURATION_MS = 1700;

export function CartScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const computeTotals = useCartStore((state) => state.computeTotals);
  const clearCart = useCartStore((state) => state.clear);
  const auth = useAuthContext();
  const user = useAuthStore((state) => state.user);
  const { data: menuItems } = useMenuItems();
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const editingMenuItem = editingLine ? menuItems?.find((item) => item.id === editingLine.menuItemId) : null;
  const editingCategory = editingMenuItem?.category ?? null;
  const selectedPaymentOption = usePaymentMethodStore((state) => state.selected);
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

  async function handleProceedToPay() {
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
      <FlatList
        style={styles.list}
        data={lines}
        keyExtractor={(line) => line.lineId}
        renderItem={({ item: line }) => (
          <View style={styles.line}>
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
        )}
      />

      <Pressable style={styles.addMoreButton} onPress={() => navigation.navigate("Menu")}>
        <Text style={styles.addMoreButtonText}>+ Add More Items</Text>
      </Pressable>

      <View style={styles.spacer} />

      <PriceBreakdown result={result} />

      {!profileComplete && (
        <Pressable style={styles.completeProfileBanner} onPress={() => navigation.navigate("Checkout")}>
          <Text style={styles.completeProfileText}>Complete your profile for a seamless experience</Text>
          <Text style={styles.completeProfileArrow}>→</Text>
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
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    list: { flexGrow: 0 },
    spacer: { flex: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.background },
    emptyText: { color: colors.muted },
    browseButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingHorizontal: 20, paddingVertical: 10 },
    browseButtonText: { color: "#fff", fontWeight: "700" },
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginTop: theme.spacing(1.5),
    },
    completeProfileText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.primary },
    completeProfileArrow: { fontSize: 16, fontWeight: "800", color: colors.primary, marginLeft: 8 },
    actionRow: { flexDirection: "row", gap: theme.spacing(1), marginTop: theme.spacing(1.5) },
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
