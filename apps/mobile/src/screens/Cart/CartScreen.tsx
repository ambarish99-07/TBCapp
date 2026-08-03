import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { PriceBreakdown } from "../../components/PriceBreakdown.js";
import { theme } from "../../constants/theme.js";
import { useCartStore } from "../../state/cartStore.js";
import { useAuthContext } from "../../state/useAuthContext.js";
import type { RootStackParamList } from "../../navigation/types.js";

type Props = NativeStackScreenProps<RootStackParamList, "Cart">;

export function CartScreen({ navigation }: Props) {
  const lines = useCartStore((state) => state.lines);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeLine = useCartStore((state) => state.removeLine);
  const computeTotals = useCartStore((state) => state.computeTotals);
  const auth = useAuthContext();

  if (lines.length === 0) {
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

  return (
    <View style={styles.screen}>
      <FlatList
        data={lines}
        keyExtractor={(line) => line.lineId}
        renderItem={({ item: line }) => (
          <View style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineName}>{line.signatureName}</Text>
              <Text style={styles.lineMeta}>
                Sugar: {line.sugarLevel} · Ice: {line.iceLevel}
                {line.addOnIds.length > 0 ? ` · ${line.addOnIds.length} add-on(s)` : ""}
              </Text>
              <View style={styles.qtyRow}>
                <Pressable onPress={() => setQuantity(line.lineId, line.quantity - 1)} style={styles.qtyButton}>
                  <Text>-</Text>
                </Pressable>
                <Text style={styles.qtyValue}>{line.quantity}</Text>
                <Pressable onPress={() => setQuantity(line.lineId, line.quantity + 1)} style={styles.qtyButton}>
                  <Text>+</Text>
                </Pressable>
                <Pressable onPress={() => removeLine(line.lineId)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.lineTotal}>₹{(line.unitPrice + line.addOnPrices.reduce((s, p) => s + p, 0)) * line.quantity}</Text>
          </View>
        )}
      />

      <PriceBreakdown result={result} />

      <Pressable style={styles.checkoutButton} onPress={() => navigation.navigate("Checkout")}>
        <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { color: theme.colors.muted },
  browseButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, paddingHorizontal: 20, paddingVertical: 10 },
  browseButtonText: { color: "#fff", fontWeight: "700" },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing(1.5), borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineName: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  lineMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  qtyButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  qtyValue: { fontWeight: "700" },
  remove: { color: theme.colors.danger, fontSize: 12, marginLeft: 8 },
  lineTotal: { fontWeight: "700", color: theme.colors.text },
  checkoutButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginTop: theme.spacing(2) },
  checkoutButtonText: { color: "#fff", fontWeight: "700" },
});
