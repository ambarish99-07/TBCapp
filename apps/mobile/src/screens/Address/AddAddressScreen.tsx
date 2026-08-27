import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { updateProfileRequest } from "../../api/auth.api";
import { createSavedRecipient } from "../../api/recipients.api";
import { SUPPORTED_CITY } from "../../constants/deliveryZone";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAddressStore } from "../../state/addressStore";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import { formatAddressLine } from "../../utils/formatAddress";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "AddAddress">;

export function AddAddressScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const setSelectedAddress = useAddressStore((state) => state.setSelectedAddress);
  const queryClient = useQueryClient();
  const prefill = route.params;

  const [form, setForm] = useState({
    label: "",
    fullName: user?.fullName ?? "",
    phone: user?.phone ?? "",
    houseNumber: "",
    area: prefill?.area ?? "",
    address: prefill?.address ?? "",
    landmark: "",
    // Always Patna — this app only ever delivers here (see deliveryZone.ts), so the field below
    // is a fixed display rather than free text a search/reverse-geocode result could otherwise
    // fill with a locality name instead of the city itself (e.g. "Vijay Nagar"), which the
    // server's delivery-zone check would then reject.
    city: SUPPORTED_CITY,
    pincode: prefill?.pincode ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.label.trim() || !form.fullName.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.pincode.trim()) {
      Alert.alert("Missing details", "Please fill in label, name, phone, address, city, and pincode.");
      return;
    }
    setIsSaving(true);
    try {
      const saved = await createSavedRecipient(form);
      queryClient.invalidateQueries({ queryKey: ["saved-recipients"] });
      setSelectedAddress({ label: saved.label, city: saved.city, line: formatAddressLine(saved) });
      // Also writes through to the account's own address (User.address/city/pincode) — that's
      // what Proceed to Pay/checkout actually reads, so saving an address here needs to unblock
      // it immediately, not just add another entry to the saved-recipients list.
      try {
        updateUser(
          await updateProfileRequest({
            fullName: saved.fullName,
            email: user?.email,
            phone: saved.phone,
            houseNumber: saved.houseNumber,
            area: saved.area,
            address: saved.address,
            landmark: saved.landmark,
            city: saved.city,
            pincode: saved.pincode,
          })
        );
      } catch {
        // Best-effort — the saved-recipient entry and its selection above still succeeded either way.
      }
      // Skip back past the Addresses list screen too — saving is the end of this whole flow.
      navigation.popToTop();
    } catch {
      Alert.alert("Couldn't save address", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: theme.spacing(2) }} keyboardShouldPersistTaps="handled">
      <TextInput style={styles.input} placeholder="Label (e.g. Home, Work)" placeholderTextColor={colors.muted} value={form.label} onChangeText={(v) => updateField("label", v)} />
      <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.muted} value={form.fullName} onChangeText={(v) => updateField("fullName", v)} />
      <TextInput style={styles.input} placeholder="Phone" placeholderTextColor={colors.muted} value={form.phone} onChangeText={(v) => updateField("phone", v)} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="House / flat number" placeholderTextColor={colors.muted} value={form.houseNumber} onChangeText={(v) => updateField("houseNumber", v)} />
      <TextInput style={styles.input} placeholder="Area" placeholderTextColor={colors.muted} value={form.area} onChangeText={(v) => updateField("area", v)} />
      <TextInput style={styles.input} placeholder="Address" placeholderTextColor={colors.muted} value={form.address} onChangeText={(v) => updateField("address", v)} />
      <TextInput style={styles.input} placeholder="Landmark (optional)" placeholderTextColor={colors.muted} value={form.landmark} onChangeText={(v) => updateField("landmark", v)} />
      {/* Fixed, not editable — see the comment on the form's initial state above. */}
      <Text style={styles.cityFixed}>City: {form.city}</Text>
      <TextInput style={styles.input} placeholder="Pincode" placeholderTextColor={colors.muted} value={form.pincode} onChangeText={(v) => updateField("pincode", v)} keyboardType="number-pad" />

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Address</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1),
      color: colors.text,
      backgroundColor: colors.surface,
    },
    cityFixed: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: theme.spacing(1.5) },
    saveButton: { padding: theme.spacing(1.5), alignItems: "center", borderRadius: theme.radius, backgroundColor: colors.primary, marginTop: theme.spacing(1) },
    saveButtonText: { color: "#fff", fontWeight: "700" },
  });
