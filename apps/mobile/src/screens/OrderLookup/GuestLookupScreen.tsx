import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Order } from "@tbc/shared-types";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchOrderByAccessToken } from "../../api/orders.api";
import { StatusTimeline } from "../../components/StatusTimeline";
import { theme } from "../../constants/theme";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "GuestLookup">;

/**
 * Guests track their order using the accessToken from their confirmation screen —
 * never the raw order id, which would let someone enumerate other customers' orders.
 */
export function GuestLookupScreen(_props: Props) {
  const [token, setToken] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setError(null);
    setOrder(null);
    try {
      const found = await fetchOrderByAccessToken(token.trim());
      setOrder(found);
    } catch {
      setError("We couldn't find an order with that code.");
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Track a Guest Order</Text>
      <TextInput
        style={styles.input}
        placeholder="Paste your order tracking code"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={handleLookup}>
        <Text style={styles.buttonText}>Track Order</Text>
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {order && (
        <View style={styles.result}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <StatusTimeline status={order.status} history={order.statusHistory} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text, marginBottom: theme.spacing(2) },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing(1.25), marginBottom: theme.spacing(1.5) },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: theme.colors.danger, marginTop: theme.spacing(1.5) },
  result: { marginTop: theme.spacing(3) },
  orderNumber: { fontSize: 16, fontWeight: "700", marginBottom: theme.spacing(2) },
});
