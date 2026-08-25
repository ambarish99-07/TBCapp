import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ADD_ON_PRICES, round } from "@tbc/pricing";
import { isComboLineId, type Brand, type Order } from "@tbc/shared-types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useBrands } from "../../api/brands.api";
import { useAllMenuItems } from "../../api/menu.api";
import { fetchMyOrders } from "../../api/orders.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useBrandStore } from "../../state/brandStore";
import { useTheme } from "../../state/themeStore";
import { addLineWithBrandGuard } from "../../utils/addToCartWithBrandGuard";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "OrderHistory">;

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function OrderHistoryScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const { data: orders, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: fetchMyOrders, enabled: !!user });
  const { data: brands } = useBrands();
  // Cross-brand — a past order could be from any brand, not just whichever one happens to be
  // ambiently selected right now, and Reorder needs each item's *current* price/image, not the
  // possibly-stale snapshot stored on the historical order.
  const { data: allMenuItems } = useAllMenuItems();
  const selectBrand = useBrandStore((state) => state.selectBrand);
  const restoreBrand = useBrandStore((state) => state.restoreBrand);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [search, setSearch] = useState("");

  function brandFor(order: Order) {
    return brands?.find((brand) => brand.id === order.brandId);
  }

  // A "history" of orders that never happened (received, still in progress) or didn't go through
  // (cancelled) isn't really history — an in-progress order is already reachable via the "View
  // Order Status" pill, and this list is meant to be "what have I actually gotten before", which
  // is exactly what Reorder needs to be meaningful.
  const deliveredOrders = useMemo(() => (orders ?? []).filter((order) => order.status === "delivered"), [orders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return deliveredOrders;
    return deliveredOrders.filter((order) => {
      const brandName = brandFor(order)?.name.toLowerCase() ?? "";
      const matchesDish = order.items.some((line) => line.signatureName.toLowerCase().includes(query));
      return brandName.includes(query) || matchesDish;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [deliveredOrders, brands, search]);

  // Same brand-switch handleOpenRestaurant uses everywhere else in the app (selectBrand clears
  // the cart — a deliberate switch to browse a different brand's menu, same as tapping the hero
  // carousel or the footer brand picker). No order-tracking link here anymore — the customer can
  // already reach an in-progress order's tracking from the "View Order Status" pill; this list is
  // about repeating what they liked, not re-checking a delivery that already happened.
  function handleViewMenu(brand: Brand) {
    if (brand.id === "gg-tiffin") {
      restoreBrand(brand);
      navigation.navigate("TiffinLanding");
      return;
    }
    selectBrand(brand);
    navigation.navigate("RestaurantMenu");
  }

  // Re-adds every still-on-the-menu item from a past order, at today's price — not the order's
  // own historical one, since a shake's price (or its add-on prices) can have moved since. Combo
  // lines and anything since delisted are skipped rather than guessed at.
  function handleReorder(order: Order) {
    let addedCount = 0;
    for (const line of order.items) {
      if (isComboLineId(line.menuItemId)) continue;
      const liveItem = allMenuItems?.find((item) => item.id === line.menuItemId);
      if (!liveItem) continue;
      const unitPrice = liveItem.salePercent ? round(liveItem.price * (1 - liveItem.salePercent / 100)) : liveItem.price;
      addLineWithBrandGuard({
        lineId: `${liveItem.id}-${Date.now()}-${addedCount}`,
        brandId: liveItem.brandId,
        menuItemId: liveItem.id,
        signatureName: liveItem.signatureName,
        commonName: liveItem.commonName,
        image: liveItem.image,
        unitPrice,
        originalUnitPrice: liveItem.price,
        addOnPrices: line.customization.addOnIds.map((id) => ADD_ON_PRICES[id]),
        quantity: line.quantity,
        sugarLevel: line.customization.sugarLevel,
        iceLevel: line.customization.iceLevel,
        addOnIds: line.customization.addOnIds,
        comment: line.customization.comment,
        isCombo: false,
        category: liveItem.category === "signature-shakes" || liveItem.category === "cold-coffee" ? liveItem.category : undefined,
      });
      addedCount += 1;
    }
    if (addedCount === 0) {
      Alert.alert("Can't reorder this one", "None of these items are on the menu anymore.");
      return;
    }
    navigation.navigate("Cart");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="🔍 Search by restaurant or dish"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading && <Text style={styles.info}>Loading orders…</Text>}
      {!isLoading && filteredOrders.length === 0 && (
        <Text style={styles.info}>{deliveredOrders.length > 0 ? "No orders match your search." : "No delivered orders yet."}</Text>
      )}

      <FlatList
        data={filteredOrders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: order }) => {
          const brand = brandFor(order);
          return (
            <View style={styles.card}>
              <Pressable style={styles.cardHeader} onPress={() => brand && handleViewMenu(brand)} disabled={!brand}>
                {order.items[0]?.image ? (
                  <Image source={{ uri: order.items[0].image }} style={styles.brandLogo} resizeMode="cover" />
                ) : (
                  <View style={[styles.brandLogo, styles.brandLogoPlaceholder]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandName}>{brand?.name ?? "Order"}</Text>
                  <Text style={styles.viewMenuLink}>View Menu ›</Text>
                </View>
                {order.deliveryFor === "recipient" && <Text style={styles.deliveryForBadge}>For someone else</Text>}
              </Pressable>

              <View style={styles.itemsList}>
                {order.items.map((line) => (
                  <Text key={line.lineId} style={styles.itemLine} numberOfLines={1}>
                    {line.quantity} × {line.signatureName}
                  </Text>
                ))}
              </View>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.orderDate}>Ordered on {formatOrderDate(order.createdAt)}</Text>
                  <Text style={styles.orderStatus}>Delivered</Text>
                </View>
                <Text style={styles.orderTotal}>₹{order.totals.total}</Text>
              </View>

              <Pressable style={styles.reorderButton} onPress={() => handleReorder(order)}>
                <Text style={styles.reorderButtonText}>↻ Reorder</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    searchWrap: { padding: theme.spacing(2), paddingBottom: theme.spacing(1) },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1.25),
      color: colors.text,
      backgroundColor: colors.surface,
    },
    info: { textAlign: "center", color: colors.muted, marginTop: theme.spacing(3) },
    listContent: { padding: theme.spacing(2), paddingTop: 0, gap: theme.spacing(1.5) },
    card: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.25) },
    brandLogo: { width: 44, height: 44, borderRadius: 10 },
    brandLogoPlaceholder: { backgroundColor: colors.border },
    brandName: { fontSize: 16, fontWeight: "800", color: colors.text },
    viewMenuLink: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: 2 },
    deliveryForBadge: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.primary,
      backgroundColor: colors.accent + "22",
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    itemsList: { marginTop: theme.spacing(1.5), gap: 3 },
    itemLine: { fontSize: 13, color: colors.text },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginTop: theme.spacing(1.5),
      paddingTop: theme.spacing(1.25),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    orderDate: { fontSize: 11, color: colors.muted },
    orderStatus: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: 2 },
    orderTotal: { fontSize: 15, fontWeight: "800", color: colors.text },
    reorderButton: {
      marginTop: theme.spacing(1.5),
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1),
      alignItems: "center",
    },
    reorderButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  });
