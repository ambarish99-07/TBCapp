import type { MenuItem } from "@tbc/shared-types";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme.js";
import { PlaceholderBadge } from "./PlaceholderBadge.js";

interface Props {
  item: MenuItem;
  onPress: () => void;
}

export function MenuItemCard({ item, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.image }} style={styles.image} />
        <PlaceholderBadge />
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{item.signatureName}</Text>
        <Text style={styles.subtitle}>{item.commonName}</Text>
        <View style={styles.badgeRow}>
          {item.isStaffPick && <Text style={styles.badge}>Staff Pick</Text>}
          {item.isPopular && <Text style={styles.badge}>Trending</Text>}
          {item.isNew && <Text style={styles.badge}>New</Text>}
        </View>
        <Text style={styles.price}>₹{item.price}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    marginBottom: theme.spacing(2),
    overflow: "hidden",
  },
  imageWrap: { width: 96, height: 96 },
  image: { width: "100%", height: "100%" },
  body: { flex: 1, padding: theme.spacing(1.5) },
  name: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  subtitle: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.primary,
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  price: { marginTop: 6, fontSize: 14, fontWeight: "700", color: theme.colors.primary },
});
