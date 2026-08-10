import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ADD_ON_PRICES, round } from "@tbc/pricing";
import type { AddOnId, IceLevel, SugarLevel } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMenuItems } from "../../api/menu.api";
import { AddOnSelector } from "../../components/AddOnSelector";
import { theme, type ColorPalette } from "../../constants/theme";
import { useCartStore } from "../../state/cartStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

const LEVELS: { key: SugarLevel | IceLevel; label: string }[] = [
  { key: "less", label: "Less" },
  { key: "regular", label: "Regular" },
  { key: "extra", label: "Extra" },
];

export function ItemDetailScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: items } = useMenuItems();
  const item = items?.find((candidate) => candidate.id === route.params.menuItemId);

  const [sugarLevel, setSugarLevel] = useState<SugarLevel>("regular");
  const [iceLevel, setIceLevel] = useState<IceLevel>("regular");
  const [addOnIds, setAddOnIds] = useState<AddOnId[]>([]);
  const [quantity, setQuantity] = useState(1);
  const addLine = useCartStore((state) => state.addLine);

  if (!item) {
    return (
      <View style={styles.screen}>
        <Text>Item not found.</Text>
      </View>
    );
  }

  const effectivePrice = item.salePercent ? round(item.price * (1 - item.salePercent / 100)) : item.price;
  const addOnTotal = addOnIds.reduce((sum, id) => sum + ADD_ON_PRICES[id], 0);
  const lineTotal = (effectivePrice + addOnTotal) * quantity;

  function handleAddToCart() {
    addLine({
      lineId: `${item!.id}-${Date.now()}`,
      menuItemId: item!.id,
      signatureName: item!.signatureName,
      commonName: item!.commonName,
      image: item!.image,
      unitPrice: effectivePrice,
      originalUnitPrice: item!.price,
      addOnPrices: addOnIds.map((id) => ADD_ON_PRICES[id]),
      quantity,
      sugarLevel,
      iceLevel,
      addOnIds,
      isCombo: false,
      category: item!.category,
    });
    navigation.navigate("Cart");
  }

  return (
    <ScrollView style={styles.screen}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image }} style={styles.image} />
      </View>

      <Text style={styles.name}>{item.signatureName}</Text>
      <Text style={styles.subtitle}>{item.commonName}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <View style={styles.priceRow}>
        {item.salePercent ? (
          <>
            <Text style={styles.priceStrikethrough}>₹{item.price}</Text>
            <Text style={styles.price}>₹{effectivePrice}</Text>
            <Text style={styles.saleBadge}>{item.salePercent}% OFF</Text>
          </>
        ) : (
          <Text style={styles.price}>₹{item.price}</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Sugar Level</Text>
      <View style={styles.levelRow}>
        {LEVELS.map((level) => (
          <Pressable
            key={level.key}
            onPress={() => setSugarLevel(level.key as SugarLevel)}
            style={[styles.levelChip, sugarLevel === level.key && styles.levelChipActive]}
          >
            <Text style={[styles.levelText, sugarLevel === level.key && styles.levelTextActive]}>{level.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Ice Level</Text>
      <View style={styles.levelRow}>
        {LEVELS.map((level) => (
          <Pressable
            key={level.key}
            onPress={() => setIceLevel(level.key as IceLevel)}
            style={[styles.levelChip, iceLevel === level.key && styles.levelChipActive]}
          >
            <Text style={[styles.levelText, iceLevel === level.key && styles.levelTextActive]}>{level.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Add-Ons</Text>
      <AddOnSelector selected={addOnIds} onChange={setAddOnIds} />

      <Text style={styles.sectionTitle}>Quantity</Text>
      <View style={styles.qtyRow}>
        <Pressable style={styles.qtyButton} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
          <Text style={styles.qtyButtonText}>-</Text>
        </Pressable>
        <Text style={styles.qtyValue}>{quantity}</Text>
        <Pressable style={styles.qtyButton} onPress={() => setQuantity((q) => Math.min(20, q + 1))}>
          <Text style={styles.qtyButtonText}>+</Text>
        </Pressable>
      </View>

      <Pressable style={styles.addButton} onPress={handleAddToCart}>
        <Text style={styles.addButtonText}>Add to Cart · ₹{lineTotal}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    imageWrap: { width: "100%", height: 220, borderRadius: theme.radius, overflow: "hidden" },
    image: { width: "100%", height: "100%" },
    name: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: theme.spacing(2) },
    subtitle: { fontSize: 13, color: colors.muted },
    description: { fontSize: 14, color: colors.text, marginTop: 8 },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    price: { fontSize: 18, fontWeight: "700", color: colors.primary },
    priceStrikethrough: { fontSize: 14, color: colors.muted, textDecorationLine: "line-through" },
    saleBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: "#fff",
      backgroundColor: colors.danger,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(2), marginBottom: 8 },
    levelRow: { flexDirection: "row", gap: 8 },
    levelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface },
    levelChipActive: { backgroundColor: colors.primary },
    levelText: { fontSize: 12, color: colors.text },
    levelTextActive: { color: "#fff", fontWeight: "700" },
    qtyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    qtyButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    qtyButtonText: { fontSize: 18, fontWeight: "700", color: colors.text },
    qtyValue: { fontSize: 16, fontWeight: "700", color: colors.text },
    addButton: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginVertical: theme.spacing(3) },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
