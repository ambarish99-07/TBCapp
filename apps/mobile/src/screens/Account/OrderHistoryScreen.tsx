import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchMyOrders } from "../../api/orders.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "OrderHistory">;

export function OrderHistoryScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const { data: orders, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: fetchMyOrders, enabled: !!user });
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.screen}>
      {isLoading && <Text style={styles.info}>Loading orders…</Text>}
      {!isLoading && (!orders || orders.length === 0) && <Text style={styles.info}>No orders yet.</Text>}
      <FlatList
        data={orders ?? []}
        keyExtractor={(order) => order.id}
        renderItem={({ item: order }) => (
          <Pressable style={styles.orderRow} onPress={() => navigation.navigate("OrderStatus", { accessToken: order.accessToken })}>
            <View style={styles.orderRowHeader}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              <Text style={[styles.deliveryForBadge, order.deliveryFor === "recipient" && styles.deliveryForBadgeRecipient]}>
                {order.deliveryFor === "recipient" ? "For someone else" : "Delivered to me"}
              </Text>
            </View>
            <Text style={styles.orderMeta}>
              {order.status} · ₹{order.totals.total}
            </Text>
            {order.deliveryFor === "recipient" && (
              <Text style={styles.orderMeta}>
                To {order.delivery.fullName} · {order.delivery.address}, {order.delivery.city}
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    info: { textAlign: "center", color: colors.muted, marginTop: theme.spacing(3) },
    orderRow: { paddingVertical: theme.spacing(1.5), borderBottomWidth: 1, borderBottomColor: colors.border },
    orderRowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    orderNumber: { fontWeight: "700", color: colors.text },
    orderMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
    deliveryForBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.muted,
      backgroundColor: colors.surface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    deliveryForBadgeRecipient: { color: colors.primary, backgroundColor: colors.accent + "22" },
  });
