import { round } from "@tbc/pricing";
import type { MenuItem } from "@tbc/shared-types";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

interface Props {
  item: MenuItem;
  /** Opens the Add popup (quantity + customize) for this item — see AddItemModal.
   * Tapping anywhere on the card (not just the Add button) triggers this; there's no
   * separate read-only detail page to navigate to anymore. */
  onAddPress: () => void;
}

export function MenuItemCard({ item, onAddPress }: Props) {
  const { colors, spacing, radius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, radius), [colors, spacing, radius]);
  const isAvailable = item.isAvailable ?? true;
  const effectivePrice = item.salePercent ? round(item.price * (1 - item.salePercent / 100)) : item.price;

  return (
    <Pressable style={styles.card} onPress={isAvailable ? onAddPress : undefined}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image }} style={[styles.image, !isAvailable && styles.imageUnavailable]} />
        {isAvailable && item.salePercent && (
          <View style={styles.saleCorner}>
            <Text style={styles.saleCornerText}>{item.salePercent}% OFF</Text>
          </View>
        )}
        {!isAvailable && (
          <View style={styles.outOfStockCorner}>
            <Text style={styles.outOfStockCornerText}>OUT OF STOCK</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, !isAvailable && styles.nameUnavailable]}>{item.signatureName}</Text>
        <Text style={styles.subtitle}>{item.commonName}</Text>
        <View style={styles.badgeRow}>
          {item.isStaffPick && <Text style={styles.badge}>Staff Pick</Text>}
          {item.isPopular && <Text style={styles.badge}>Trending</Text>}
          {item.isNew && <Text style={styles.badge}>New</Text>}
        </View>
        <View style={styles.bottomRow}>
          {!isAvailable ? (
            <Text style={styles.priceStrikethrough}>₹{item.price}</Text>
          ) : item.salePercent ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceStrikethrough}>₹{item.price}</Text>
              <Text style={styles.price}>₹{effectivePrice}</Text>
            </View>
          ) : (
            <Text style={styles.price}>₹{item.price}</Text>
          )}
          {isAvailable && (
            <Pressable style={styles.addButton} onPress={onAddPress}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ColorPalette, spacing: (n: number) => number, radius: number) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius,
      marginBottom: spacing(2),
      overflow: "hidden",
    },
    imageWrap: { width: 96, height: 96 },
    image: { width: "100%", height: "100%" },
    imageUnavailable: { opacity: 0.4 },
    body: { flex: 1, padding: spacing(1.5) },
    name: { fontSize: 16, fontWeight: "700", color: colors.text },
    nameUnavailable: { color: colors.muted, textDecorationLine: "line-through" },
    subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
    badgeRow: { flexDirection: "row", gap: 6, marginTop: 6 },
    badge: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.primary,
      backgroundColor: colors.background,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    price: { fontSize: 14, fontWeight: "700", color: colors.primary },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    priceStrikethrough: { fontSize: 12, color: colors.muted, textDecorationLine: "line-through" },
    saleCorner: {
      position: "absolute",
      bottom: 4,
      left: 4,
      backgroundColor: colors.danger,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    saleCornerText: { color: "#fff", fontSize: 9, fontWeight: "700" },
    outOfStockCorner: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
      paddingVertical: 3,
      alignItems: "center",
    },
    outOfStockCornerText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
    addButton: { backgroundColor: colors.primary, borderRadius: radius, paddingVertical: 6, paddingHorizontal: 18 },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  });
