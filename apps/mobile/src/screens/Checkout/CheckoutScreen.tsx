import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { updateProfileRequest } from "../../api/auth.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

/**
 * Saves the account's own delivery address (same PATCH /auth/me as EditProfileScreen) —
 * opened from Cart's "Complete your profile" nudge, or to update it later. Once saved,
 * Cart never asks for it again: Proceed to Pay reads straight from the account.
 */
export function CheckoutScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [fields, setFields] = useState({
    fullName: user?.fullName ?? "",
    phone: user?.phone ?? "",
    houseNumber: user?.houseNumber ?? "",
    area: user?.area ?? "",
    address: user?.address ?? "",
    landmark: user?.landmark ?? "",
    city: user?.city ?? "Patna",
    pincode: user?.pincode ?? "",
  });
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUpdateAddress() {
    if (!fields.fullName.trim() || !fields.phone.trim() || !fields.address.trim() || !fields.city.trim() || !fields.pincode.trim()) {
      Alert.alert("Missing details", "Please fill in all delivery fields.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfileRequest({
        fullName: fields.fullName.trim(),
        email: user?.email,
        phone: fields.phone.trim(),
        houseNumber: fields.houseNumber.trim() || undefined,
        area: fields.area.trim() || undefined,
        address: fields.address.trim(),
        landmark: fields.landmark.trim() || undefined,
        city: fields.city.trim(),
        pincode: fields.pincode.trim(),
      });
      updateUser(updated);
      // Back to wherever this was opened from (Cart, or GG Tiffin's checkout) — that's what
      // lets the customer proceed straight to payment/subscribing now.
      navigation.goBack();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Please try again.";
      Alert.alert("Couldn't save address", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.sectionTitle}>Delivery Details</Text>
      <TextInput style={styles.input} placeholder="Full name" value={fields.fullName} onChangeText={(v) => setField("fullName", v)} />
      <TextInput
        style={styles.input}
        placeholder="Phone number"
        value={fields.phone}
        onChangeText={(v) => setField("phone", v)}
        keyboardType="phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="House / Flat / Building number"
        value={fields.houseNumber}
        onChangeText={(v) => setField("houseNumber", v)}
      />
      <TextInput style={styles.input} placeholder="Area / Locality" value={fields.area} onChangeText={(v) => setField("area", v)} />
      <TextInput style={styles.input} placeholder="Address" value={fields.address} onChangeText={(v) => setField("address", v)} multiline />
      <TextInput style={styles.input} placeholder="Landmark" value={fields.landmark} onChangeText={(v) => setField("landmark", v)} />
      <TextInput style={styles.input} placeholder="City" value={fields.city} onChangeText={(v) => setField("city", v)} />
      <TextInput
        style={styles.input}
        placeholder="Pincode"
        value={fields.pincode}
        onChangeText={(v) => setField("pincode", v)}
        keyboardType="number-pad"
      />
      <Text style={styles.helperText}>Saved once, used for every order — update it here any time you move.</Text>

      <Pressable style={styles.submitButton} onPress={handleUpdateAddress} disabled={saving}>
        <Text style={styles.submitButtonText}>{saving ? "Saving…" : "Update Address"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1),
      color: colors.text,
    },
    helperText: { fontSize: 11, color: colors.muted, marginBottom: theme.spacing(1) },
    submitButton: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginVertical: theme.spacing(3) },
    submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
