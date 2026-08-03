import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchMyOrders } from "../../api/orders.api.js";
import { theme } from "../../constants/theme.js";
import { useAuthStore } from "../../state/authStore.js";
import { useAuthContext } from "../../state/useAuthContext.js";
import type { RootStackParamList } from "../../navigation/types.js";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

const TIER_LABELS = { "first-order": "First Order", returning: "Returning Customer", gold: "Gold Member" } as const;

export function AccountScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const auth = useAuthContext();
  const { data: orders } = useQuery({ queryKey: ["my-orders"], queryFn: fetchMyOrders, enabled: !!user });

  if (!user) {
    return (
      <View style={styles.screen}>
        <Text style={styles.info}>Log in to see your loyalty status and order history.</Text>
        <Pressable style={styles.button} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.buttonText}>Log In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.name}>{user.fullName}</Text>
      <Text style={styles.email}>{user.email}</Text>

      <View style={styles.loyaltyCard}>
        <Text style={styles.loyaltyTier}>{auth.tier ? TIER_LABELS[auth.tier] : "—"}</Text>
        <Text style={styles.loyaltyMeta}>{user.loyalty.completedOrderCount} orders completed</Text>
        <Text style={styles.loyaltyMeta}>
          Punch card: {user.punchCard.ordersSinceReward}/5 towards your next 50% off reward
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Order History</Text>
      <FlatList
        data={orders ?? []}
        keyExtractor={(order) => order.id}
        renderItem={({ item: order }) => (
          <Pressable style={styles.orderRow} onPress={() => navigation.navigate("OrderStatus", { orderId: order.id })}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.orderMeta}>
              {order.status} · ₹{order.totals.total}
            </Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  info: { color: theme.colors.muted, marginBottom: theme.spacing(2) },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  name: { fontSize: 20, fontWeight: "800" },
  email: { fontSize: 13, color: theme.colors.muted, marginBottom: theme.spacing(2) },
  loyaltyCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  loyaltyTier: { fontSize: 16, fontWeight: "800", color: theme.colors.primary },
  loyaltyMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: theme.spacing(1) },
  orderRow: { paddingVertical: theme.spacing(1), borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  orderNumber: { fontWeight: "700" },
  orderMeta: { fontSize: 12, color: theme.colors.muted },
  logoutButton: { marginTop: theme.spacing(3), alignItems: "center" },
  logoutButtonText: { color: theme.colors.danger, fontWeight: "700" },
});
