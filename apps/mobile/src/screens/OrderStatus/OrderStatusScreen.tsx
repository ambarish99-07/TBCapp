import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@tbc/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import { cancelOrderRequest, fetchOrderByAccessToken } from "../../api/orders.api";
import { DISCOUNT_LABELS, REWARD_LABELS } from "../../components/PriceBreakdown";
import { StatusTimeline } from "../../components/StatusTimeline";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { mapEmbedHtml } from "../../utils/mapEmbed";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "OrderStatus">;

function cancellationPolicyText(status: OrderStatus): string {
  if (status === "received") {
    return "Cancel now for a full refund — your order hasn't started preparing yet.";
  }
  if (status === "delivered") {
    return "This order has already been delivered. If something went wrong (spilled, wrong item, never arrived), cancelling now refunds 30% of the total.";
  }
  return "Your order is already being prepared or is on its way — cancelling now refunds 50% of the total.";
}

function deliveryAddressLine(order: { delivery: { houseNumber?: string; area?: string; address: string; city: string; pincode: string } }): string {
  const line1 = [order.delivery.houseNumber, order.delivery.area, order.delivery.address].filter(Boolean).join(", ");
  return `${line1}, ${order.delivery.city} ${order.delivery.pincode}`;
}

/** COD orders never had a payment actually go through, so there's nothing left to review (no
 * refund confirmation to read) — cancelling one bounces straight home instead of leaving the
 * customer stranded on a now-dead order's page. Razorpay orders stay put so the refund amount is
 * visible. */
const HOME_REDIRECT_DELAY_MS = 3000;

export function OrderStatusScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", route.params.accessToken],
    queryFn: () => fetchOrderByAccessToken(route.params.accessToken),
    refetchInterval: 15000,
  });
  const [showCancelPolicy, setShowCancelPolicy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
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
      await cancelOrderRequest(route.params.accessToken, cancelReason.trim() || undefined);
      await queryClient.invalidateQueries({ queryKey: ["order", route.params.accessToken] });
      await queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      setShowCancelPolicy(false);
      setCancelReason("");
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

  if (error) {
    return (
      <View style={styles.screen}>
        <Text style={styles.errorText}>Couldn't load this order. Check your connection and try again.</Text>
      </View>
    );
  }

  if (isLoading || !order) {
    return (
      <View style={styles.screen}>
        <Text style={styles.summaryText}>Loading order…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.orderNumber}>{order.orderNumber}</Text>
        <Text style={styles.eta}>Estimated delivery: {order.estimatedMinutes} minutes</Text>

        {order.deliveryFor === "recipient" && (
          <Text style={styles.recipientBanner}>
            Your order has been placed successfully and will be delivered to {order.delivery.fullName} at {order.delivery.address},{" "}
            {order.delivery.city}.
          </Text>
        )}

        <StatusTimeline status={order.status} history={order.statusHistory} />

        {order.status === "cancelled" && (
          <View style={styles.card}>
            <Text style={styles.cancelledText}>This order was cancelled.</Text>
            {order.payment.refundAmount !== undefined ? (
              <Text style={styles.refundText}>₹{order.payment.refundAmount} refunded.</Text>
            ) : (
              <Text style={styles.refundText}>No refund applies to this cancellation.</Text>
            )}
            {order.cancellationReason && <Text style={styles.refundReasonText}>Reason: {order.cancellationReason}</Text>}
            {redirectingHome && <Text style={styles.redirectText}>Redirecting to home page in 3 seconds…</Text>}
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your Order</Text>
          {order.items.map((line) => (
            <View key={line.lineId} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{line.signatureName}</Text>
                <Text style={styles.itemMeta}>Qty {line.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{(line.unitPrice + line.addOnPrices.reduce((sum, price) => sum + price, 0)) * line.quantity}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          {order.totals.discountAmount > 0 && DISCOUNT_LABELS[order.totals.discountReason] && (
            <View style={styles.newCustomerBanner}>
              <Text style={styles.newCustomerBannerText}>{DISCOUNT_LABELS[order.totals.discountReason]} applied to this order!</Text>
            </View>
          )}
          {order.totals.rewardAmount > 0 && (
            <View style={styles.newCustomerBanner}>
              <Text style={styles.newCustomerBannerText}>{REWARD_LABELS[order.totals.rewardReason]} applied to this order!</Text>
            </View>
          )}

          {/* Subtotal/discount/delivery/tax line items already live on the Cart screen's own price
              breakdown right before checkout — repeating all of them here was just noise on a
              screen whose job is tracking the order, not re-auditing its price. Just the bottom
              line stays. */}
          <View style={styles.divider} />
          <View style={styles.totalsRow}>
            <Text style={styles.summaryTitleStrong}>Total</Text>
            <Text style={styles.summaryTitleStrong}>₹{order.totals.total}</Text>
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{order.deliveryFor === "recipient" ? "Delivering to" : "Delivering to (you)"}</Text>
          <Text style={styles.summaryText}>{order.delivery.fullName}</Text>
          <Text style={styles.summaryText}>{deliveryAddressLine(order)}</Text>
          {order.delivery.landmark && <Text style={styles.summaryText}>Landmark: {order.delivery.landmark}</Text>}
          <Text style={styles.summaryText}>{order.delivery.phone}</Text>
          <View style={styles.mapWrap}>
            <WebView source={{ html: mapEmbedHtml(deliveryAddressLine(order)) }} style={styles.map} />
          </View>
          <Text style={styles.summaryTitle}>Payment</Text>
          <Text style={styles.summaryText}>
            {order.payment.method === "cod" ? "Pay on Delivery" : "Paid Online"} · {order.payment.status}
          </Text>
        </View>

        {order.status !== "cancelled" && (
          <Pressable style={styles.cancelButton} onPress={() => setShowCancelPolicy(true)}>
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={showCancelPolicy} animationType="fade" transparent onRequestClose={() => setShowCancelPolicy(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCancelPolicy(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Cancellation Policy</Text>
            <Text style={styles.modalBody}>{cancellationPolicyText(order.status)}</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="What happened? (optional)"
              placeholderTextColor={colors.muted}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
            />
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
    orderNumber: { fontSize: 18, fontWeight: "800", color: colors.primary },
    eta: { fontSize: 13, color: colors.muted, marginBottom: theme.spacing(2) },
    recipientBanner: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
      fontSize: 13,
      color: colors.text,
      fontWeight: "600",
    },
    card: { marginTop: theme.spacing(2), backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    cancelledText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
    refundText: { color: colors.primary, fontWeight: "800", fontSize: 15, marginTop: 4 },
    refundReasonText: { color: colors.muted, fontSize: 13, marginTop: 4 },
    redirectText: { color: colors.muted, fontSize: 12, fontStyle: "italic", marginTop: theme.spacing(1) },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6 },
    itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
    itemName: { fontSize: 14, fontWeight: "700", color: colors.text },
    itemMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
    itemPrice: { fontSize: 14, fontWeight: "700", color: colors.text },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: theme.spacing(1) },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    summaryTitleStrong: { fontSize: 15, fontWeight: "800", color: colors.text },
    newCustomerBanner: {
      backgroundColor: colors.accent + "22",
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: theme.radius,
      padding: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    newCustomerBannerText: { color: colors.primary, fontWeight: "800", fontSize: 13, textAlign: "center" },
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
    summary: { marginTop: theme.spacing(2), backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    summaryTitle: { fontSize: 12, color: colors.muted, marginTop: 8 },
    summaryText: { fontSize: 14, color: colors.text, fontWeight: "600" },
    mapWrap: { height: 180, borderRadius: theme.radius, overflow: "hidden", marginTop: theme.spacing(1.5) },
    map: { flex: 1 },
    errorText: { color: colors.danger, textAlign: "center", marginTop: theme.spacing(4) },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.5),
      alignItems: "center",
      marginTop: theme.spacing(2),
    },
    cancelButtonText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: theme.spacing(3) },
    modalCard: { backgroundColor: colors.background, borderRadius: theme.radius, padding: theme.spacing(2.5) },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    modalBody: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: theme.spacing(1.5) },
    reasonInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      color: colors.text,
      fontSize: 13,
      minHeight: 60,
      textAlignVertical: "top",
      marginBottom: theme.spacing(2),
    },
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
