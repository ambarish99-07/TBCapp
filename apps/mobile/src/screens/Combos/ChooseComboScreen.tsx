import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useBrands } from "../../api/brands.api";
import { useAllCombos, useAllMenuItems } from "../../api/menu.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ChooseCombo">;

export function ChooseComboScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Cross-brand, not scoped to the selected brand — this same screen serves both a normal
  // brand's own choose-n combo and the cross-brand "Mix & Match Duo", so its eligible items
  // may span every live brand's menu, not just whichever one happens to be selected.
  const { data: combos } = useAllCombos();
  const { data: menuItems } = useAllMenuItems();
  const { data: brands } = useBrands();
  const addLine = useCartStore((state) => state.addLine);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const combo = combos?.find((c) => c.id === route.params.comboId);

  if (!combo || combo.type !== "choose-n") {
    return (
      <View style={styles.screen}>
        <Text>Combo not found.</Text>
      </View>
    );
  }

  function itemPrice(id: string): number {
    return menuItems?.find((item) => item.id === id)?.price ?? 0;
  }

  function brandName(id: string): string {
    const item = menuItems?.find((candidate) => candidate.id === id);
    if (!item) return "";
    return brands?.find((brand) => brand.id === item.brandId)?.name ?? item.brandId;
  }

  function toggle(itemId: string) {
    setSelectedIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      if (current.length >= (combo!.type === "choose-n" ? combo!.chooseCount : 0)) return current;
      return [...current, itemId];
    });
  }

  function handleAddToCart() {
    addLine(
      makeComboCartLine({
        comboId: combo!.id,
        name: combo!.name,
        description: selectedIds.map((id) => menuItems?.find((item) => item.id === id)?.signatureName ?? id).join(" + "),
        image: combo!.image ?? menuItems?.find((item) => item.id === selectedIds[0])?.image,
        constituentBasePrices: selectedIds.map(itemPrice),
        payload: selectedIds.join("+"),
      })
    );
    // Back to the combo list, not into the cart — the floating summary bar confirms it landed.
    navigation.goBack();
  }

  const isComplete = selectedIds.length === combo.chooseCount;
  const livePrice = isComplete ? computeComboPrice(selectedIds.map(itemPrice)) : null;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{combo.name}</Text>
      <Text style={styles.subtitle}>
        Pick {combo.chooseCount} items · {selectedIds.length}/{combo.chooseCount} selected · 15% off their combined price
      </Text>

      <FlatList
        data={combo.eligibleItemIds}
        keyExtractor={(id) => id}
        renderItem={({ item: itemId }) => {
          const item = menuItems?.find((candidate) => candidate.id === itemId);
          const isSelected = selectedIds.includes(itemId);
          return (
            <Pressable style={[styles.row, isSelected && styles.rowSelected]} onPress={() => toggle(itemId)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowBrand, isSelected && styles.rowTextSelected]}>{brandName(itemId)}</Text>
                <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>
                  {item?.signatureName ?? itemId} {item ? `· ₹${item.price}` : ""}
                </Text>
              </View>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          );
        }}
      />

      <Pressable style={[styles.addButton, !isComplete && styles.addButtonDisabled]} onPress={handleAddToCart} disabled={!isComplete}>
        <Text style={styles.addButtonText}>{isComplete ? `Add to Cart · ₹${livePrice}` : `Select ${combo.chooseCount} to continue`}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    title: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: 12, color: colors.muted, marginBottom: theme.spacing(2) },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing(1.5),
      borderRadius: theme.radius,
      backgroundColor: colors.surface,
      marginBottom: 8,
    },
    rowSelected: { backgroundColor: colors.primary },
    rowBrand: { fontSize: 10, fontWeight: "700", color: colors.primary, textTransform: "uppercase" },
    rowText: { fontSize: 14, color: colors.text, fontWeight: "600", marginTop: 2 },
    rowTextSelected: { color: "#fff" },
    checkmark: { color: "#fff", fontWeight: "700" },
    addButton: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginTop: theme.spacing(2) },
    addButtonDisabled: { opacity: 0.4 },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
