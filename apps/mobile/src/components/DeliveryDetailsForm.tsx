import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { updateProfileRequest } from "../api/auth.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useAuthStore } from "../state/authStore";
import { useTheme } from "../state/themeStore";

interface Props {
  /** Called once the address is saved and the account is updated — the caller decides what
   * happens next (navigate back, close a modal, etc.). */
  onSaved: () => void;
  submitLabel?: string;
}

/**
 * The account's own delivery-address fields (same PATCH /auth/me as EditProfileScreen) — shared
 * between CheckoutScreen (a full page, opened from Cart's nudge) and GG Tiffin's checkout (a
 * popup, since a tiffin subscription needs this before it can even show a "Subscribe" button).
 */
export function DeliveryDetailsForm({ onSaved, submitLabel = "Update Address" }: Props) {
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
      onSaved();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Please try again.";
      Alert.alert("Couldn't save address", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
        <Text style={styles.submitButtonText}>{saving ? "Saving…" : submitLabel}</Text>
      </Pressable>
    </>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
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
