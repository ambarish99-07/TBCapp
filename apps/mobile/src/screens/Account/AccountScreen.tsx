import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PREMIUM_ORDER_THRESHOLD, resolveIsPremiumMember } from "@tbc/pricing";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchMyOrders } from "../../api/orders.api";
import { theme } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

export function AccountScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
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

  const isPremium = resolveIsPremiumMember(user.loyalty);

  return (
    <View style={styles.screen}>
      <Text style={styles.name}>{user.fullName}</Text>
      <Text style={styles.email}>{user.email}</Text>

      <View style={styles.loyaltyCard}>
        <Text style={styles.loyaltyTier}>{isPremium ? "✨ Premium Member" : "Standard Member"}</Text>
        <Text style={styles.loyaltyMeta}>{user.loyalty.completedOrderCount} orders completed</Text>
        {!isPremium && (
          <Text style={styles.loyaltyMeta}>
            {Math.max(0, PREMIUM_ORDER_THRESHOLD - user.loyalty.completedOrderCount)} more orders to unlock Premium
            Membership (flat 25% off + free delivery within 4km)
          </Text>
        )}
        <Text style={styles.perkNote}>Every 6th order: 50% off a cold coffee</Text>
        <Text style={styles.perkNote}>Every 10th order: a free drink</Text>
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
  perkNote: { fontSize: 12, color: theme.colors.text, marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: theme.spacing(1) },
  orderRow: { paddingVertical: theme.spacing(1), borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  orderNumber: { fontWeight: "700" },
  orderMeta: { fontSize: 12, color: theme.colors.muted },
  logoutButton: { marginTop: theme.spacing(3), alignItems: "center" },
  logoutButtonText: { color: theme.colors.danger, fontWeight: "700" },
});
