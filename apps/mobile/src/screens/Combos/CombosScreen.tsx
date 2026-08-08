import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import type { Combo } from "@tbc/shared-types";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useCombos, useMenuItems } from "../../api/menu.api";
import { theme } from "../../constants/theme";
import { useCartStore } from "../../state/cartStore";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Combos">;

export function CombosScreen({ navigation }: Props) {
  const { data: combos, isLoading } = useCombos();
  const { data: menuItems } = useMenuItems();
  const addLine = useCartStore((state) => state.addLine);

  function itemName(id: string): string {
    return menuItems?.find((item) => item.id === id)?.signatureName ?? id;
  }

  function itemPrice(id: string): number {
    return menuItems?.find((item) => item.id === id)?.price ?? 0;
  }

  function handleAddCurated(combo: Extract<Combo, { type: "curated" }>) {
    addLine(
      makeComboCartLine({
        comboId: combo.id,
        name: combo.name,
        description: combo.description,
        image: combo.image ?? menuItems?.find((item) => item.id === combo.itemIds[0])?.image,
        constituentBasePrices: combo.itemIds.map(itemPrice),
        payload: "fixed",
      })
    );
    navigation.navigate("Cart");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Combos</Text>
      <Text style={styles.subtitle}>Two items, bundled at 15% off.</Text>

      {isLoading && <Text style={styles.info}>Loading combos…</Text>}

      <FlatList
        data={combos ?? []}
        keyExtractor={(combo) => combo.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item: combo }) => {
          if (combo.type === "choose-n") {
            return (
              <Pressable style={styles.card} onPress={() => navigation.navigate("ChooseCombo", { comboId: combo.id })}>
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{combo.name}</Text>
                  <Text style={styles.meta}>Pick any {combo.chooseCount} eligible items · 15% off their combined price</Text>
                  <View style={styles.button}>
                    <Text style={styles.buttonText}>Build Your Combo</Text>
                  </View>
                </View>
              </Pressable>
            );
          }

          const fullPriceSum = combo.itemIds.reduce((sum, id) => sum + itemPrice(id), 0);
          const comboPrice = computeComboPrice(combo.itemIds.map(itemPrice));
          const savings = Math.max(0, fullPriceSum - comboPrice);

          return (
            <View style={styles.card}>
              {combo.image && <Image source={{ uri: combo.image }} style={styles.image} />}
              <View style={styles.cardBody}>
                <Text style={styles.name}>{combo.name}</Text>
                <Text style={styles.description}>{combo.itemIds.map(itemName).join(" + ")}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceStrikethrough}>₹{fullPriceSum}</Text>
                  <Text style={styles.price}>₹{comboPrice}</Text>
                  {savings > 0 && <Text style={styles.savingsBadge}>Save ₹{savings}</Text>}
                </View>
                <Pressable style={styles.button} onPress={() => handleAddCurated(combo)}>
                  <Text style={styles.buttonText}>Add to Cart</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2) },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.primary },
  subtitle: { fontSize: 12, color: theme.colors.muted, marginBottom: theme.spacing(2) },
  info: { textAlign: "center", color: theme.colors.muted, marginVertical: theme.spacing(2) },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius, marginBottom: theme.spacing(2), overflow: "hidden" },
  image: { width: "100%", height: 120 },
  cardBody: { padding: theme.spacing(1.5) },
  name: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  description: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  meta: { fontSize: 12, color: theme.colors.text, marginTop: 6 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  priceStrikethrough: { fontSize: 13, color: theme.colors.muted, textDecorationLine: "line-through" },
  price: { fontSize: 16, fontWeight: "700", color: theme.colors.primary },
  savingsBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  button: { backgroundColor: theme.colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.25), alignItems: "center", marginTop: theme.spacing(1.5) },
  buttonText: { color: "#fff", fontWeight: "700" },
});
