import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { WebView } from "react-native-webview";
import { reverseGeocode, searchPatnaAddresses, type AddressSuggestion } from "../../api/addressSearch.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import { interactiveMapHtml } from "../../utils/interactiveMapEmbed";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "PickLocation">;

// Patna's rough city-center coordinates — same city the search below is scoped to (see
// PATNA_VIEWBOX in addressSearch.api.ts). Just a starting point for the map before GPS/search
// resolves anything more specific.
const PATNA_CENTER = { lat: 25.5941, lon: 85.1376 };

export function PickLocationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const webViewRef = useRef<WebView>(null);

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolved, setResolved] = useState<AddressSuggestion | null>(null);

  // Debounced live search, same pattern as the Addresses screen.
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

  // Auto-detect on arrival — the footer is meant to show an address that's "already been
  // detected" the moment this screen opens, not just after the customer taps something.
  useEffect(() => {
    handleDetectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recenterMap(lat: number, lon: number) {
    webViewRef.current?.injectJavaScript(`window.recenterMap(${lat}, ${lon}); true;`);
  }

  async function handleDetectLocation() {
    setIsDetecting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location permission needed", "Enable location access to auto-detect, or search/drop a pin manually.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      recenterMap(latitude, longitude);
      const address = await reverseGeocode(latitude, longitude);
      setResolved(address);
    } catch {
      Alert.alert("Couldn't detect your location", "Please search for your address or drop a pin on the map instead.");
    } finally {
      setIsDetecting(false);
    }
  }

  async function handleMapMessage(event: WebViewMessageEvent) {
    try {
      const { lat, lon } = JSON.parse(event.nativeEvent.data) as { lat: number; lon: number };
      setIsResolving(true);
      const address = await reverseGeocode(lat, lon);
      setResolved(address);
    } catch {
      // The pin already moved visually in the WebView regardless — just no resolved address text this time.
    } finally {
      setIsResolving(false);
    }
  }

  function handleSelectSuggestion(suggestion: AddressSuggestion) {
    setSearch("");
    setSuggestions([]);
    setResolved(suggestion);
    recenterMap(suggestion.lat, suggestion.lon);
  }

  function handleConfirm() {
    if (!resolved) return;
    navigation.navigate("AddAddress", {
      address: resolved.address,
      area: resolved.area,
      city: resolved.city,
      pincode: resolved.pincode,
    });
  }

  // Skips the map/search flow entirely — hands off to AddAddress with no prefill, since its
  // params are all optional, so the customer can just type the whole address by hand.
  function handleManualEntry() {
    navigation.navigate("AddAddress", undefined);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search any address in Patna..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        <Pressable style={styles.manualEntryTab} onPress={handleManualEntry}>
          <Text style={styles.manualEntryText}>Enter address manually ›</Text>
        </Pressable>
        {isSearching && <Text style={styles.info}>Searching…</Text>}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            {suggestions.map((suggestion) => (
              <Pressable key={suggestion.id} style={styles.suggestionRow} onPress={() => handleSelectSuggestion(suggestion)}>
                <Text style={styles.suggestionText} numberOfLines={2}>
                  📍 {suggestion.displayName}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.mapWrap}>
        <WebView
          ref={webViewRef}
          source={{ html: interactiveMapHtml(PATNA_CENTER.lat, PATNA_CENTER.lon) }}
          style={styles.map}
          onMessage={handleMapMessage}
        />
        <Pressable style={styles.detectButton} onPress={handleDetectLocation} disabled={isDetecting}>
          {isDetecting ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.detectButtonText}>🎯</Text>}
        </Pressable>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerAddressRow}>
          <Text style={styles.footerIcon}>📍</Text>
          <Text style={styles.footerAddressText} numberOfLines={2}>
            {isDetecting || isResolving ? "Detecting your location…" : (resolved?.displayName ?? "Search or drop a pin to set your location")}
          </Text>
        </View>
        <Pressable style={[styles.confirmButton, !resolved && styles.confirmButtonDisabled]} onPress={handleConfirm} disabled={!resolved}>
          <Text style={styles.confirmButtonText}>Confirm &amp; Proceed</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    searchWrap: { padding: theme.spacing(2), paddingBottom: theme.spacing(1), zIndex: 2 },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      color: colors.text,
      backgroundColor: colors.surface,
    },
    info: { fontSize: 12, color: colors.muted, marginTop: 6 },
    manualEntryTab: { alignSelf: "flex-end", marginTop: theme.spacing(1) },
    manualEntryText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    // Floats over the map below it rather than pushing it down — a dropdown, not its own section.
    suggestionsBox: {
      position: "absolute",
      top: theme.spacing(2) + 48,
      left: theme.spacing(2),
      right: theme.spacing(2),
      backgroundColor: colors.background,
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 220,
      overflow: "hidden",
    },
    suggestionRow: { padding: theme.spacing(1.25), borderBottomWidth: 1, borderBottomColor: colors.border },
    suggestionText: { fontSize: 13, color: colors.text },
    mapWrap: { flex: 1, position: "relative" },
    map: { flex: 1 },
    detectButton: {
      position: "absolute",
      bottom: theme.spacing(2),
      right: theme.spacing(2),
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    detectButtonText: { fontSize: 20 },
    footer: {
      padding: theme.spacing(2),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    footerAddressRow: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing(1.5) },
    footerIcon: { fontSize: 18, marginRight: theme.spacing(1) },
    footerAddressText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: "600" },
    confirmButton: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.5), alignItems: "center" },
    confirmButtonDisabled: { opacity: 0.5 },
    confirmButtonText: { color: "#fff", fontWeight: "700" },
  });
