import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { SavedRecipient } from "@tbc/shared-types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { updateProfileRequest } from "../api/auth.api";
import { fetchSavedRecipients } from "../api/recipients.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useAddressStore } from "../state/addressStore";
import { useAuthStore } from "../state/authStore";
import { useTheme } from "../state/themeStore";
import { formatAddressLine } from "../utils/formatAddress";
import type { RootStackParamList } from "../navigation/types";

// Plain dark neutral instead of a colorful emoji — same monochrome treatment as the Menu screen's
// own footer icons (Menu/Combos/Bulk Deals).
const ICON_COLOR = "#3A342C";

/** Label + address line + dropdown, right-aligned in the Cart screen's own header (headerRight) —
 * same "home icon, short label, chevron" shape as delivery apps' order-tracking header, but opens
 * a lightweight popup here (add / pick a saved address) instead of navigating to the full-page
 * Addresses screen, since this is meant to be a quick in-place switch without losing cart context. */
export function CartAddressButton() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const selectedAddress = useAddressStore((state) => state.selectedAddress);
  const setSelectedAddress = useAddressStore((state) => state.setSelectedAddress);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [isOpen, setIsOpen] = useState(false);
  // Same queryKey the full Addresses screen uses, so both share one cache entry — always fetched
  // (not gated on the popup being open) so the "default to Home" effect below can run as soon as
  // the Cart screen mounts, not only after the customer taps the header button.
  const { data: addresses } = useQuery({ queryKey: ["saved-recipients"], queryFn: fetchSavedRecipients });

  // The account's own delivery address (User.address/city/pincode) is what Proceed to Pay and
  // checkout actually read from — picking an address here needs to write through to that, not
  // just update this header's own display, or "Proceed to Pay" would stay disabled even with a
  // saved address selected.
  async function syncAccountAddress(address: SavedRecipient) {
    try {
      const updated = await updateProfileRequest({
        fullName: address.fullName,
        email: user?.email,
        phone: address.phone,
        houseNumber: address.houseNumber,
        area: address.area,
        address: address.address,
        landmark: address.landmark,
        city: address.city,
        pincode: address.pincode,
      });
      updateUser(updated);
    } catch {
      // Best-effort — the header still reflects the pick even if this sync fails; Proceed to Pay
      // just stays gated until the customer retries or fills in Checkout directly.
    }
  }

  function handleSelect(address: SavedRecipient) {
    setSelectedAddress({ label: address.label, city: address.city, line: formatAddressLine(address) });
    setIsOpen(false);
    syncAccountAddress(address);
  }

  // Defaults to the saved "Home" address (or the first saved address if none is labeled that)
  // the moment one exists and nothing valid is already picked — so a customer who's already
  // saved an address doesn't have to open this popup at all before checking out. `selectedAddress`
  // is a device-level cache, not account-scoped, so it can be left over from a different account
  // that was logged in earlier on this same device — checked against this account's own
  // `addresses` before trusting it, and cleared if it doesn't match anything real for this account.
  useEffect(() => {
    if (!addresses) return; // still loading
    const matchesThisAccount = !!selectedAddress && addresses.some((a) => a.label === selectedAddress.label && a.city === selectedAddress.city);
    if (matchesThisAccount) return;
    if (addresses.length === 0) {
      if (selectedAddress) setSelectedAddress(null);
      return;
    }
    const home = addresses.find((address) => address.label.trim().toLowerCase() === "home") ?? addresses[0];
    handleSelect(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses, selectedAddress]);

  function handleAddAddress() {
    setIsOpen(false);
    navigation.navigate("PickLocation");
  }

  return (
    <>
      <Pressable style={styles.button} onPress={() => setIsOpen(true)}>
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>
            {selectedAddress?.label ?? "Address"}
          </Text>
          <MaterialCommunityIcons name="home-outline" size={15} color={ICON_COLOR} style={styles.icon} />
          <Text style={styles.chevron}>⌄</Text>
        </View>
        {selectedAddress?.line && (
          <Text style={styles.line} numberOfLines={1}>
            {selectedAddress.line}
          </Text>
        )}
      </Pressable>

      <Modal visible={isOpen} animationType="fade" transparent onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setIsOpen(false)}>
          <View style={styles.card}>
            <Pressable style={styles.addRow} onPress={handleAddAddress}>
              <Text style={styles.addRowPlus}>+</Text>
              <Text style={styles.addRowText}>Add Address</Text>
            </Pressable>

            {(addresses ?? []).map((address) => {
              const isSelected = selectedAddress?.label === address.label && selectedAddress?.city === address.city;
              return (
                <Pressable key={address.id} style={styles.addressCard} onPress={() => handleSelect(address)}>
                  {isSelected && (
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>Selected</Text>
                    </View>
                  )}
                  <View style={styles.addressRow}>
                    <MaterialCommunityIcons name="home-outline" size={20} color={ICON_COLOR} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addressLabel}>{address.label}</Text>
                      <Text style={styles.addressSummary} numberOfLines={2}>
                        {formatAddressLine(address)}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    button: { alignItems: "flex-end", maxWidth: 150 },
    labelRow: { flexDirection: "row", alignItems: "center" },
    icon: { marginLeft: 4 },
    label: { flexShrink: 1, fontSize: 13, fontWeight: "700", color: colors.text },
    chevron: { fontSize: 12, fontWeight: "800", color: colors.muted, marginLeft: 2 },
    line: { fontSize: 11, color: colors.muted, marginTop: 2, maxWidth: 150 },
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-start", padding: theme.spacing(2) },
    card: { marginTop: 60, backgroundColor: colors.background, borderRadius: theme.radius, padding: theme.spacing(2) },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: "dashed",
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.5),
    },
    addRowPlus: { fontSize: 16, fontWeight: "800", color: colors.primary, marginRight: theme.spacing(1) },
    addRowText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
    addressCard: { position: "relative", marginTop: theme.spacing(1.5) },
    // Sits half-overlapping the card's own top edge, like a little tab poking up from behind it.
    selectedTag: {
      position: "absolute",
      top: -10,
      left: theme.spacing(1.5),
      backgroundColor: colors.primary,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      zIndex: 1,
    },
    selectedTagText: { color: "#fff", fontSize: 10, fontWeight: "800" },
    addressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing(1.25),
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
    },
    addressLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
    addressSummary: { fontSize: 12, color: colors.muted, marginTop: 2 },
  });
