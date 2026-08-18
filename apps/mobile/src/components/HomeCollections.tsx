import { computeComboPrice, round } from "@tbc/pricing";
import type { Brand, Combo, MenuItem } from "@tbc/shared-types";
import { useMemo, type ReactElement } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";
import { addLineWithBrandGuard } from "../utils/addToCartWithBrandGuard";
import { makeComboCartLine } from "../utils/comboCartLine";

export function Row<T>({ title, data, keyExtractor, renderItem }: { title: string; data: T[]; keyExtractor: (item: T) => string; renderItem: (item: T) => ReactElement }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeRowStyles(colors), [colors]);

  if (data.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => renderItem(item)}
        contentContainerStyle={styles.rowContent}
      />
    </View>
  );
}

function ItemMiniCard({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  const effectivePrice = item.salePercent ? round(item.price * (1 - item.salePercent / 100)) : item.price;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <Text style={styles.name} numberOfLines={1}>
        {item.signatureName}
      </Text>
      <View style={styles.priceRow}>
        {item.salePercent ? (
          <>
            <Text style={styles.priceStrikethrough}>₹{item.price}</Text>
            <Text style={styles.price}>₹{effectivePrice}</Text>
          </>
        ) : (
          <Text style={styles.price}>₹{item.price}</Text>
        )}
      </View>
    </Pressable>
  );
}

function ComboMiniCard({ combo, itemPrice, onChoosePress }: { combo: Combo; itemPrice: (id: string) => number; onChoosePress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  if (combo.type === "curated") {
    // Captured outside the closure below — TS narrowing on `combo.type` doesn't carry into
    // a nested function declaration, since the closure could in principle outlive it.
    const itemIds = combo.itemIds;
    const fullPriceSum = itemIds.reduce((sum, id) => sum + itemPrice(id), 0);
    const comboPrice = computeComboPrice(itemIds.map(itemPrice));

    function handleAdd() {
      addLineWithBrandGuard(
        makeComboCartLine({
          comboId: combo.id,
          brandId: combo.brandId,
          name: combo.name,
          description: combo.description,
          image: combo.image,
          constituentBasePrices: itemIds.map(itemPrice),
          payload: "fixed",
        })
      );
    }

    return (
      <Pressable style={styles.card} onPress={handleAdd}>
        {combo.image ? <Image source={{ uri: combo.image }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
        <Text style={styles.name} numberOfLines={1}>
          {combo.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceStrikethrough}>₹{fullPriceSum}</Text>
          <Text style={styles.price}>₹{comboPrice}</Text>
        </View>
        <Text style={styles.hint}>Tap to add</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.card} onPress={onChoosePress}>
      {combo.image ? <Image source={{ uri: combo.image }} style={styles.image} /> : <View style={[styles.image, styles.imagePlaceholder]} />}
      <Text style={styles.name} numberOfLines={1}>
        {combo.name}
      </Text>
      <Text style={styles.hint}>Build Your Combo</Text>
    </Pressable>
  );
}

// Full-width row, not the small square card the rows above use — a menu-item-card look
// (image left, bigger bold name right) reads better for a short list of just a few restaurants.
function RestaurantRow({ brand, representativeItem, onPress }: { brand: Brand; representativeItem: MenuItem | undefined; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeRestaurantRowStyles(colors), [colors]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {representativeItem?.image ? (
        <Image source={{ uri: representativeItem.image }} style={styles.image} />
      ) : brand.logoUrl ? (
        // No items yet (e.g. GG Tiffin Service) — the brand's own logo stands in until one exists.
        <Image source={{ uri: brand.logoUrl }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {brand.name}
        </Text>
        {brand.tagline && (
          <Text style={styles.tagline} numberOfLines={1}>
            {brand.tagline}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>→</Text>
    </Pressable>
  );
}

interface Props {
  items: MenuItem[];
  /** Already scoped to the brand being browsed — the one cross-brand combo has its own home on the dedicated Combos screen. */
  combos: Combo[];
  onItemPress: (item: MenuItem) => void;
  onChooseCombo: (combo: Combo) => void;
  /** Items this customer has ordered across 2+ separate past orders for this brand — empty
   * (and thus hidden, via Row's own empty guard) for guests and first-time customers. */
  mostlyOrdered: MenuItem[];
}

/**
 * Home-page discovery rows, each derived from data already on hand (no extra fetches) and
 * each hidden entirely when it has nothing to show rather than an empty section:
 * Recommended (isPopular), Mostly Ordered (repeat customer history), Offers (this brand's
 * combos), Discounts (salePercent items), Signature (signature-shakes category), Premium
 * Picks (isStaffPick). The Restaurants row lives separately (see RestaurantsRow below) — it's
 * cross-brand and shouldn't disappear just because the brand currently being browsed (e.g. GG
 * Tiffin) has no MenuItem-based rows of its own.
 */
export function HomeCollections({ items, combos, onItemPress, onChooseCombo, mostlyOrdered }: Props) {
  const recommended = useMemo(() => items.filter((item) => item.isPopular), [items]);
  const discounts = useMemo(() => items.filter((item) => item.salePercent), [items]);
  const signature = useMemo(() => items.filter((item) => item.category === "signature-shakes"), [items]);
  const premium = useMemo(() => items.filter((item) => item.isStaffPick), [items]);

  function itemPrice(id: string): number {
    return items.find((item) => item.id === id)?.price ?? 0;
  }

  return (
    <View>
      <Row title="Recommended For You" data={recommended} keyExtractor={(item) => item.id} renderItem={(item) => <ItemMiniCard item={item} onPress={() => onItemPress(item)} />} />
      <Row title="Mostly Ordered" data={mostlyOrdered} keyExtractor={(item) => item.id} renderItem={(item) => <ItemMiniCard item={item} onPress={() => onItemPress(item)} />} />
      <Row title="Offers" data={combos} keyExtractor={(combo) => combo.id} renderItem={(combo) => <ComboMiniCard combo={combo} itemPrice={itemPrice} onChoosePress={() => onChooseCombo(combo)} />} />
      <Row title="Discounts" data={discounts} keyExtractor={(item) => item.id} renderItem={(item) => <ItemMiniCard item={item} onPress={() => onItemPress(item)} />} />
      <Row title="Signature" data={signature} keyExtractor={(item) => item.id} renderItem={(item) => <ItemMiniCard item={item} onPress={() => onItemPress(item)} />} />
      <Row title="Premium Picks" data={premium} keyExtractor={(item) => item.id} renderItem={(item) => <ItemMiniCard item={item} onPress={() => onItemPress(item)} />} />
    </View>
  );
}

/**
 * Every live brand (including GG Tiffin), independent of whichever brand's rows are showing
 * above it — rendered once by MenuScreen regardless of which brand is currently selected, so it
 * never disappears just because the carousel (or a deliberate tap) has switched Home over to
 * GG Tiffin's own rows.
 */
export function RestaurantsRow({ brands, allItems, onOpenRestaurant }: { brands: Brand[]; allItems: MenuItem[]; onOpenRestaurant: (brand: Brand) => void }) {
  const { colors } = useTheme();
  const rowStyles = useMemo(() => makeRowStyles(colors), [colors]);

  function representativeItemFor(brandId: string): MenuItem | undefined {
    const brandItems = allItems.filter((item) => item.brandId === brandId);
    return brandItems.find((item) => item.isPopular || item.isStaffPick) ?? brandItems[0];
  }

  if (brands.length === 0) return null;

  return (
    <View style={rowStyles.wrap}>
      <Text style={rowStyles.title}>Restaurants</Text>
      {brands.map((brand) => (
        <RestaurantRow key={brand.id} brand={brand} representativeItem={representativeItemFor(brand.id)} onPress={() => onOpenRestaurant(brand)} />
      ))}
    </View>
  );
}

const makeRowStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrap: { marginBottom: theme.spacing(2) },
    title: { fontSize: 15, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1) },
    rowContent: { gap: theme.spacing(1.5) },
  });

const CARD_WIDTH = 128;

const makeCardStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: { width: CARD_WIDTH },
    image: { width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: theme.radius, backgroundColor: colors.surface },
    imagePlaceholder: { alignItems: "center", justifyContent: "center" },
    name: { fontSize: 12, fontWeight: "700", color: colors.text, marginTop: 6 },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    price: { fontSize: 13, fontWeight: "700", color: colors.primary },
    priceStrikethrough: { fontSize: 11, color: colors.muted, textDecorationLine: "line-through" },
    hint: { fontSize: 10, color: colors.muted, marginTop: 2 },
  });

const makeRestaurantRowStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      marginBottom: theme.spacing(1.5),
      overflow: "hidden",
    },
    image: { width: 96, height: 96, backgroundColor: colors.background },
    imagePlaceholder: { alignItems: "center", justifyContent: "center" },
    body: { flex: 1, paddingHorizontal: theme.spacing(1.5) },
    name: { fontSize: 18, fontWeight: "800", color: colors.text },
    tagline: { fontSize: 12, color: colors.muted, marginTop: 2 },
    chevron: { fontSize: 18, fontWeight: "800", color: colors.primary, marginRight: theme.spacing(1.5) },
  });
