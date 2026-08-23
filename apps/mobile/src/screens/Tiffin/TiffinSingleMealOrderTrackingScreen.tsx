import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import type { TiffinSingleMealOrder, TiffinSingleMealOrderStatus } from "@tbc/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { cancelSingleMealOrderRequest, useMySingleMealOrders } from "../../api/tiffin.api";
import { DeliveryProgressTracker } from "../../components/DeliveryProgressTracker";
import { StepFlow, type StepFlowStep } from "../../components/StepFlow";
import { TiffinSubscriptionAndOrders } from "../../components/TiffinSubscriptionAndOrders";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { mapEmbedHtml } from "../../utils/mapEmbed";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinSingleMealOrderTracking">;

const STATUS_STEPS: StepFlowStep[] = [
  { key: "placed", label: "Placed", icon: "🧾" },
  { key: "preparing", label: "Preparing", icon: "🍳" },
  { key: "out-for-delivery", label: "Out for delivery", icon: "🛵" },
  { key: "delivered", label: "Delivered", icon: "✅" },
];

/** Cancellable any time before it's actually delivered (or already cancelled) — refund
 * eligibility, not cancellability, is what the 15-minute window gates. */
const CANCELLABLE_STATUSES: TiffinSingleMealOrderStatus[] = ["placed", "preparing", "out-for-delivery"];

/** COD orders never had a payment actually go through, so there's nothing left to review
 * (no refund confirmation to read) — cancelling one bounces straight home instead of leaving the
 * customer stranded on a now-dead order's page. Razorpay orders stay put so the refund amount is
 * visible. */
const HOME_REDIRECT_DELAY_MS = 3000;

function deliveryAddressLine(order: TiffinSingleMealOrder): string {
  const line1 = [order.delivery.houseNumber, order.delivery.area, order.delivery.address].filter(Boolean).join(", ");
  return `${line1}, ${order.delivery.city} ${order.delivery.pincode}`;
}

export function TiffinSingleMealOrderTrackingScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useMySingleMealOrders();
  const order = orders?.find((item) => item.id === route.params.orderId);
  const [showCancelPolicy, setShowCancelPolicy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [redirectingHome, setRedirectingHome] = useState(false);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current);
  }, []);

  async function handleConfirmCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      await cancelSingleMealOrderRequest(order.id);
      await queryClient.invalidateQueries({ queryKey: ["tiffin-single-meal-orders-mine"] });
      setShowCancelPolicy(false);
      if (order.payment.method === "cod") {
        setRedirectingHome(true);
        redirectTimeoutRef.current = setTimeout(() => navigation.navigate("Menu"), HOME_REDIRECT_DELAY_MS);
      }
    } catch (err) {
      Alert.alert("Couldn't cancel order", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn't find this order.</Text>
      </View>
    );
  }

  const addOnsTotal = order.addOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const total = (order.price + addOnsTotal) * order.quantity;
  const currentIndex = STATUS_STEPS.findIndex((step) => step.key === order.status);
  const outForDeliveryAt = order.statusHistory.find((entry) => entry.status === "out-for-delivery")?.at;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.dishName}>
          {order.dishName}
          {order.quantity > 1 ? ` × ${order.quantity}` : ""}
        </Text>

        {order.status === "cancelled" ? (
          <View style={styles.card}>
            <Text style={styles.cancelledText}>This order was cancelled.</Text>
            {order.payment.refundAmount ? (
              <Text style={styles.refundText}>₹{order.payment.refundAmount} refunded.</Text>
            ) : (
              <Text style={styles.refundText}>No refund — it was cancelled outside the 15-minute window.</Text>
            )}
            {redirectingHome && <Text style={styles.redirectText}>Redirecting to home page in 3 seconds…</Text>}
          </View>
        ) : (
          <View style={styles.card}>
            <StepFlow steps={STATUS_STEPS} currentIndex={currentIndex} />
          </View>
        )}

        {order.deliveryPartner && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Partner</Text>
            <Text style={styles.partnerName}>{order.deliveryPartner.name}</Text>
            <View style={styles.partnerActions}>
              <Pressable style={styles.partnerButton} onPress={() => Linking.openURL(`tel:${order.deliveryPartner!.phone}`)}>
                <Text style={styles.partnerButtonText}>📞 Call</Text>
              </Pressable>
              <Pressable style={styles.partnerButton} onPress={() => Linking.openURL(`sms:${order.deliveryPartner!.phone}`)}>
                <Text style={styles.partnerButtonText}>💬 Text</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* No estimatedMinutes here — single-meal orders are scheduled to a delivery window
            (e.g. lunch 12-2pm), not an ASAP countdown, so the tracker shows movement only,
            without inventing an "arriving in N min" claim it has no real basis for. */}
        {order.status === "out-for-delivery" && outForDeliveryAt && (
          <DeliveryProgressTracker outForDeliveryAt={outForDeliveryAt} deliveryPartnerName={order.deliveryPartner?.name} />
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivering To</Text>
          <Text style={styles.addressText}>{order.delivery.fullName}</Text>
          <Text style={styles.addressText}>{deliveryAddressLine(order)}</Text>
          <View style={styles.mapWrap}>
            <WebView source={{ html: mapEmbedHtml(deliveryAddressLine(order)) }} style={styles.map} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Total</Text>
          <Text style={styles.totalText}>₹{total}</Text>
          <Text style={styles.paymentText}>
            {order.payment.method === "cod" ? "Cash on Delivery" : "Paid Online"} · {order.payment.status}
          </Text>
        </View>

        {CANCELLABLE_STATUSES.includes(order.status) && (
          <Pressable style={styles.cancelButton} onPress={() => setShowCancelPolicy(true)}>
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </Pressable>
        )}

        <View style={styles.myTiffinDivider}>
          <Text style={styles.myTiffinDividerText}>My Tiffin</Text>
        </View>
        <TiffinSubscriptionAndOrders navigation={navigation} />
      </ScrollView>

      <Modal visible={showCancelPolicy} animationType="fade" transparent onRequestClose={() => setShowCancelPolicy(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCancelPolicy(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Cancellation Policy</Text>
            <Text style={styles.modalBody}>
              Cancel within 15 minutes of placing your order for a full refund. After 15 minutes, no refund will be
              issued.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalKeepButton} onPress={() => setShowCancelPolicy(false)} disabled={cancelling}>
                <Text style={styles.modalKeepButtonText}>Keep Order</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmButton} onPress={handleConfirmCancel} disabled={cancelling}>
                <Text style={styles.modalConfirmButtonText}>{cancelling ? "Cancelling…" : "Cancel Order"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    errorText: { color: colors.danger, fontSize: 14 },
    orderNumber: { fontSize: 13, fontWeight: "700", color: colors.muted },
    dishName: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 2, marginBottom: theme.spacing(2) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
    },
    cancelledText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
    refundText: { color: colors.muted, fontSize: 13, marginTop: 4 },
    redirectText: { color: colors.muted, fontSize: 12, fontStyle: "italic", marginTop: theme.spacing(1) },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6 },
    partnerName: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    partnerActions: { flexDirection: "row", gap: 8 },
    partnerButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.25),
      alignItems: "center",
    },
    partnerButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    addressText: { fontSize: 14, color: colors.text, fontWeight: "600", marginBottom: 2 },
    mapWrap: { height: 180, borderRadius: theme.radius, overflow: "hidden", marginTop: theme.spacing(1.5) },
    map: { flex: 1 },
    totalText: { fontSize: 18, fontWeight: "800", color: colors.primary },
    paymentText: { fontSize: 12, color: colors.muted, marginTop: 2 },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      alignItems: "center",
      marginTop: theme.spacing(1),
    },
    cancelButtonText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
    myTiffinDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: theme.spacing(3),
      paddingTop: theme.spacing(2),
      marginBottom: theme.spacing(1.5),
    },
    myTiffinDividerText: { fontSize: 16, fontWeight: "800", color: colors.text },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: theme.spacing(3) },
    modalCard: { backgroundColor: colors.background, borderRadius: theme.radius, padding: theme.spacing(2.5) },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    modalBody: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: theme.spacing(2) },
    modalActions: { flexDirection: "row", gap: 8 },
    modalKeepButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      alignItems: "center",
    },
    modalKeepButtonText: { color: colors.text, fontWeight: "700", fontSize: 14 },
    modalConfirmButton: {
      flex: 1,
      backgroundColor: colors.danger,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      alignItems: "center",
    },
    modalConfirmButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });
