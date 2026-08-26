import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SavedRecipient } from "@tbc/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { searchPatnaAddresses, type AddressSuggestion } from "../../api/addressSearch.api";
import { deleteSavedRecipient, fetchSavedRecipients } from "../../api/recipients.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAddressStore } from "../../state/addressStore";
import { useTheme } from "../../state/themeStore";
import { formatAddressLine } from "../../utils/formatAddress";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Addresses">;

export function AddressScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const setSelectedAddress = useAddressStore((state) => state.setSelectedAddress);
  const queryClient = useQueryClient();

  const { data: addresses, isLoading } = useQuery({ queryKey: ["saved-recipients"], queryFn: fetchSavedRecipients });
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Debounced live search across any address in Patna (not just this account's saved list) —
  // see api/addressSearch.api.ts for why this hits OpenStreetMap's free Nominatim endpoint.
  useEffect(() => {
    const query = search.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchPatnaAddresses(query)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setIsSearching(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  function handleSelectSuggestion(suggestion: AddressSuggestion) {
    setSearch("");
    setSuggestions([]);
    navigation.navigate("AddAddress", {
      address: suggestion.address,
      area: suggestion.area,
      city: suggestion.city,
      pincode: suggestion.pincode,
    });
  }

  function handleSelect(address: SavedRecipient) {
    setSelectedAddress({ label: address.label, city: address.city, line: formatAddressLine(address) });
    navigation.goBack();
  }

  async function handleDelete(id: string) {
    await deleteSavedRecipient(id);
    queryClient.invalidateQueries({ queryKey: ["saved-recipients"] });
  }

  async function handleUseCurrentLocation() {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location permission needed", "Enable location access to use this, or enter your address manually.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (!place) {
        Alert.alert("Couldn't detect your address", "Please enter it manually instead.");
        navigation.navigate("AddAddress", undefined);
        return;
      }
      navigation.navigate("AddAddress", {
        address: [place.name, place.street].filter(Boolean).join(", "),
        area: place.district ?? undefined,
        city: place.city ?? undefined,
        pincode: place.postalCode ?? undefined,
      });
    } catch {
      Alert.alert("Couldn't get your location", "Please check your device's location settings, or enter your address manually.");
    } finally {
      setIsLocating(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: theme.spacing(2) }} keyboardShouldPersistTaps="handled">
      <TextInput
        style={styles.search}
        placeholder="Search any address in Patna..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor={colors.muted}
      />
      {isSearching && <Text style={styles.info}>Searching…</Text>}
      {!isSearching && search.trim().length >= 3 && suggestions.length === 0 && (
        <Text style={styles.info}>No matches in Patna for "{search}".</Text>
      )}
      {suggestions.map((suggestion) => (
        <Pressable key={suggestion.id} style={styles.suggestionRow} onPress={() => handleSelectSuggestion(suggestion)}>
          <Text style={styles.suggestionText} numberOfLines={2}>
            📍 {suggestion.displayName}
          </Text>
        </Pressable>
      ))}

      <Pressable style={styles.locationButton} onPress={handleUseCurrentLocation} disabled={isLocating}>
        {isLocating ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.locationButtonText}>📍 Use my current location</Text>}
      </Pressable>

      <Pressable style={styles.addRow} onPress={() => navigation.navigate("AddAddress", undefined)}>
        <Text style={styles.addRowText}>+ Add New Address</Text>
        <Text style={styles.addRowArrow}>→</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>Saved Addresses</Text>
      {isLoading && <Text style={styles.info}>Loading addresses…</Text>}
      {!isLoading && (!addresses || addresses.length === 0) && <Text style={styles.info}>No saved addresses yet — add one above.</Text>}

      {(addresses ?? []).map((address) => (
        <View key={address.id} style={styles.addressRow}>
          <Pressable style={styles.addressRowMain} onPress={() => handleSelect(address)}>
            <Text style={styles.addressLabel}>{address.label}</Text>
            <Text style={styles.addressSummary}>
              {[address.houseNumber, address.area || address.address, address.city].filter(Boolean).join(", ")}
            </Text>
          </Pressable>
          <Pressable onPress={() => handleDelete(address.id)} hitSlop={8}>
            <Text style={styles.deleteText}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    locationButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
    locationButtonText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1.5),
      color: colors.text,
    },
    info: { textAlign: "center", color: colors.muted, marginVertical: theme.spacing(2) },
    suggestionRow: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1),
    },
    suggestionText: { fontSize: 13, color: colors.text },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
    },
    addRowText: { color: colors.primary, fontWeight: "700" },
    addRowArrow: { color: colors.primary, fontWeight: "800", fontSize: 16 },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: theme.spacing(1) },
    addressRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
    },
    addressRowMain: { flex: 1, marginRight: theme.spacing(1) },
    addressLabel: { fontSize: 15, fontWeight: "800", color: colors.text },
    addressSummary: { fontSize: 12, color: colors.muted, marginTop: 2 },
    deleteText: { fontSize: 12, color: colors.danger, fontWeight: "700" },
  });
