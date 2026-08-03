import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { fetchOrderById } from "../../api/orders.api.js";
import { StatusTimeline } from "../../components/StatusTimeline.js";
import { theme } from "../../constants/theme.js";
import type { RootStackParamList } from "../../navigation/types.js";

type Props = NativeStackScreenProps<RootStackParamList, "OrderStatus">;

export function OrderStatusScreen({ route }: Props) {
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", route.params.orderId],
    queryFn: () => fetchOrderById(route.params.orderId),
    refetchInterval: 15000,
  });

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

      <StatusTimeline status={order.status} history={order.statusHistory} />

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Delivering to</Text>
        <Text style={styles.summaryText}>{order.delivery.fullName}</Text>
        <Text style={styles.summaryText}>
          {order.delivery.address}, {order.delivery.city} {order.delivery.pincode}
        </Text>
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
  summary: { marginTop: theme.spacing(3), backgroundColor: theme.colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
  summaryTitle: { fontSize: 12, color: theme.colors.muted, marginTop: 8 },
  summaryText: { fontSize: 14, color: theme.colors.text, fontWeight: "600" },
});
