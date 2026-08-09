import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { fetchOrderByAccessToken } from "../../api/orders.api";
import { StatusTimeline } from "../../components/StatusTimeline";
import { theme } from "../../constants/theme";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "OrderStatus">;

export function OrderStatusScreen({ route }: Props) {
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", route.params.accessToken],
    queryFn: () => fetchOrderByAccessToken(route.params.accessToken),
    refetchInterval: 15000,
  });

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
        <Text>Loading order…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.orderNumber}>{order.orderNumber}</Text>
      <Text style={styles.eta}>Estimated delivery: {order.estimatedMinutes} minutes</Text>

      {order.deliveryFor === "recipient" && (
        <Text style={styles.recipientBanner}>
          Your order has been placed successfully and will be delivered to {order.delivery.fullName} at {order.delivery.address},{" "}
          {order.delivery.city}.
        </Text>
      )}

      <StatusTimeline status={order.status} history={order.statusHistory} />

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{order.deliveryFor === "recipient" ? "Delivering to" : "Delivering to (you)"}</Text>
        <Text style={styles.summaryText}>{order.delivery.fullName}</Text>
        <Text style={styles.summaryText}>
          {[order.delivery.houseNumber, order.delivery.area, order.delivery.address].filter(Boolean).join(", ")}, {order.delivery.city}{" "}
          {order.delivery.pincode}
        </Text>
        {order.delivery.landmark && <Text style={styles.summaryText}>Landmark: {order.delivery.landmark}</Text>}
        <Text style={styles.summaryText}>{order.delivery.phone}</Text>
        <Text style={styles.summaryTitle}>Payment</Text>
        <Text style={styles.summaryText}>
          {order.payment.method === "cod" ? "Pay on Delivery" : "Paid Online"} · {order.payment.status}
        </Text>
        <Text style={styles.summaryTitle}>Total</Text>
        <Text style={styles.summaryText}>₹{order.totals.total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  orderNumber: { fontSize: 18, fontWeight: "800", color: theme.colors.primary },
  eta: { fontSize: 13, color: theme.colors.muted, marginBottom: theme.spacing(2) },
  recipientBanner: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: "600",
  },
  summary: { marginTop: theme.spacing(3), backgroundColor: theme.colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
  summaryTitle: { fontSize: 12, color: theme.colors.muted, marginTop: 8 },
  summaryText: { fontSize: 14, color: theme.colors.text, fontWeight: "600" },
  errorText: { color: theme.colors.danger, textAlign: "center", marginTop: theme.spacing(4) },
});
