import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { computeComboPrice } from "@tbc/pricing";
import { FEAST_COMBO_BRAND_ID } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useBrands } from "../../api/brands.api";
import { useAllCombos, useAllMenuItems } from "../../api/menu.api";
import { useKitchensOpen } from "../../api/storeStatus.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { addLineToCart } from "../../utils/addToCart";
import { makeComboCartLine } from "../../utils/comboCartLine";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ChooseCombo">;

export function ChooseComboScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Cross-brand, not scoped to the selected brand — this same screen serves both a kitchen's own
  // choose-n combo and the Feast build-your-own, whose items span every live kitchen's menu.
  const { data: combos } = useAllCombos();
  const { data: menuItems } = useAllMenuItems();
  const { data: brands } = useBrands();
  const kitchens = useKitchensOpen();
  // In pick order. A Feast build-your-own may hold the same id more than once (e.g. 3 Chicken
  // Biryanis for a family); a kitchen's own pick-N combo never does.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const combo = combos?.find((c) => c.id === route.params.comboId);
  const isFeast = combo?.brandId === FEAST_COMBO_BRAND_ID;
  // A Feast build-your-own with no explicit list = every item from every kitchen, grouped by
  // kitchen in the Home carousel's order so a newly-launched brand simply shows up here.
  const eligibleIds = useMemo(() => {
    if (!combo || combo.type !== "choose-n") return [];
    if (combo.eligibleItemIds.length > 0 || !isFeast) return combo.eligibleItemIds;
    const kitchenOrder = kitchens.map(({ brand }) => brand.id);
    return (menuItems ?? [])
      .filter((item) => kitchenOrder.includes(item.brandId))
      .sort((a, b) => kitchenOrder.indexOf(a.brandId) - kitchenOrder.indexOf(b.brandId))
      .map((item) => item.id);
  }, [combo, isFeast, kitchens, menuItems]);

  function isKitchenOpen(itemId: string): boolean {
    const item = menuItems?.find((candidate) => candidate.id === itemId);
    return kitchens.find(({ brand }) => brand.id === item?.brandId)?.isOpen ?? true;
  }

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

  const chooseCount = combo.chooseCount;

  function isPickable(itemId: string): boolean {
    const item = menuItems?.find((candidate) => candidate.id === itemId);
    return item?.isAvailable !== false && isKitchenOpen(itemId);
  }

  function toggle(itemId: string) {
    if (!isPickable(itemId)) return;
    setSelectedIds((current) => {
      if (current.includes(itemId)) return current.filter((id) => id !== itemId);
      if (current.length >= chooseCount) return current;
      return [...current, itemId];
    });
  }

  /** Feast only: one more of this item, if there's room left. */
  function addOne(itemId: string) {
    if (!isPickable(itemId)) return;
    setSelectedIds((current) => (current.length >= chooseCount ? current : [...current, itemId]));
  }

  /** Feast only: one fewer of this item (removes its last pick). */
  function removeOne(itemId: string) {
    setSelectedIds((current) => {
      const index = current.lastIndexOf(itemId);
      return index === -1 ? current : [...current.slice(0, index), ...current.slice(index + 1)];
    });
  }

  /** "2× Chicken Biryani + Coffee Chill" — same summary the server snapshots for the kitchen. */
  function summary(ids: string[]): string {
    const counts = new Map<string, number>();
    for (const id of ids) {
      const name = menuItems?.find((item) => item.id === id)?.signatureName ?? id;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts].map(([name, count]) => (count > 1 ? `${count}× ${name}` : name)).join(" + ");
  }

  function handleAddToCart() {
    addLineToCart(
      makeComboCartLine({
        comboId: combo!.id,
        brandId: combo!.brandId,
        name: combo!.name,
        description: summary(selectedIds),
        image: combo!.image ?? menuItems?.find((item) => item.id === selectedIds[0])?.image,
        constituentBasePrices: selectedIds.map(itemPrice),
        payload: selectedIds.join("+"),
        discountPercent: combo!.discountPercent,
        constituentBrandIds: isFeast
          ? selectedIds.map((id) => menuItems?.find((item) => item.id === id)?.brandId ?? "").filter(Boolean)
          : undefined,
      })
    );
    // Back to the combo list, not into the cart — the floating summary bar confirms it landed.
    navigation.goBack();
  }

  const isComplete = selectedIds.length === combo.chooseCount;
  const livePrice = isComplete ? computeComboPrice(selectedIds.map(itemPrice), combo.discountPercent) : null;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{combo.name}</Text>
      <Text style={styles.subtitle}>
        Pick {combo.chooseCount} items{isFeast ? " from any of our kitchens — repeats welcome" : ""} · {selectedIds.length}/
        {combo.chooseCount} selected ·{" "}
        {combo.discountPercent ?? 15}% off their combined price
      </Text>

      <FlatList
        data={eligibleIds}
        keyExtractor={(id) => id}
        renderItem={({ item: itemId }) => {
          const item = menuItems?.find((candidate) => candidate.id === itemId);
          const kitchenOpen = isKitchenOpen(itemId);
          const isAvailable = (item?.isAvailable ?? true) && kitchenOpen;
          const count = selectedIds.filter((id) => id === itemId).length;
          const isSelected = count > 0;
          if (isFeast) {
            // Feast: a +/− stepper per item so the same dish can be picked several times.
            return (
              <View style={[styles.row, isSelected && styles.rowPicked, !isAvailable && styles.rowDisabled]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowBrand}>{brandName(itemId)}</Text>
                  <Text style={[styles.rowText, !isAvailable && styles.rowTextUnavailable]}>
                    {item?.signatureName ?? itemId} {item ? `· ₹${item.price}` : ""}
                    {!kitchenOpen ? " · Kitchen closed" : !isAvailable ? " · Out of stock" : ""}
                  </Text>
                </View>
                {isAvailable && (
                  <View style={styles.stepper}>
                    {count > 0 && (
                      <>
                        <Pressable style={styles.stepperButton} onPress={() => removeOne(itemId)} hitSlop={6}>
                          <Text style={styles.stepperButtonText}>−</Text>
                        </Pressable>
                        <Text style={styles.stepperCount}>{count}</Text>
                      </>
                    )}
                    <Pressable
                      style={[styles.stepperButton, selectedIds.length >= chooseCount && styles.addButtonDisabled]}
                      onPress={() => addOne(itemId)}
                      disabled={selectedIds.length >= chooseCount}
                      hitSlop={6}
                    >
                      <Text style={styles.stepperButtonText}>+</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }
          return (
            <Pressable
              style={[styles.row, isSelected && styles.rowSelected, !isAvailable && styles.rowDisabled]}
              onPress={() => toggle(itemId)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowBrand, isSelected && styles.rowTextSelected]}>{brandName(itemId)}</Text>
                <Text style={[styles.rowText, isSelected && styles.rowTextSelected, !isAvailable && styles.rowTextUnavailable]}>
                  {item?.signatureName ?? itemId} {item ? `· ₹${item.price}` : ""}
                  {!kitchenOpen ? " · Kitchen closed" : !isAvailable ? " · Out of stock" : ""}
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
    rowPicked: { borderWidth: 1.5, borderColor: colors.primary },
    stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepperButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    stepperCount: { fontWeight: "800", color: colors.text, minWidth: 14, textAlign: "center" },
    rowDisabled: { opacity: 0.5 },
    rowBrand: { fontSize: 10, fontWeight: "700", color: colors.primary, textTransform: "uppercase" },
    rowText: { fontSize: 14, color: colors.text, fontWeight: "600", marginTop: 2 },
    rowTextUnavailable: { textDecorationLine: "line-through" },
    rowTextSelected: { color: "#fff" },
    checkmark: { color: "#fff", fontWeight: "700" },
    addButton: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginTop: theme.spacing(2) },
    addButtonDisabled: { opacity: 0.4 },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
