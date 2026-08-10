import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { updateProfileRequest } from "../../api/auth.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

export function EditProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [form, setForm] = useState({
    fullName: user?.fullName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    houseNumber: user?.houseNumber ?? "",
    area: user?.area ?? "",
    address: user?.address ?? "",
    landmark: user?.landmark ?? "",
    city: user?.city ?? "",
    pincode: user?.pincode ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      Alert.alert("Missing name", "Full name can't be empty.");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateProfileRequest({
        fullName: form.fullName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        houseNumber: form.houseNumber.trim() || undefined,
        area: form.area.trim() || undefined,
        address: form.address.trim() || undefined,
        landmark: form.landmark.trim() || undefined,
        city: form.city.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
      });
      updateUser(updated);
      navigation.goBack();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Please try again.";
      Alert.alert("Couldn't save profile", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: theme.spacing(2) }} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionLabel}>Personal Details</Text>
      <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.muted} value={form.fullName} onChangeText={(v) => updateField("fullName", v)} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={form.email}
        onChangeText={(v) => updateField("email", v)}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput style={styles.input} placeholder="Phone" placeholderTextColor={colors.muted} value={form.phone} onChangeText={(v) => updateField("phone", v)} keyboardType="phone-pad" />

      <Text style={styles.sectionLabel}>Address</Text>
      <Text style={styles.sectionHint}>Moved to a new locality? Update it here in one go.</Text>
      <TextInput style={styles.input} placeholder="House / flat number" placeholderTextColor={colors.muted} value={form.houseNumber} onChangeText={(v) => updateField("houseNumber", v)} />
      <TextInput style={styles.input} placeholder="Area" placeholderTextColor={colors.muted} value={form.area} onChangeText={(v) => updateField("area", v)} />
      <TextInput style={styles.input} placeholder="Address" placeholderTextColor={colors.muted} value={form.address} onChangeText={(v) => updateField("address", v)} />
      <TextInput style={styles.input} placeholder="Landmark (optional)" placeholderTextColor={colors.muted} value={form.landmark} onChangeText={(v) => updateField("landmark", v)} />
      <TextInput style={styles.input} placeholder="City" placeholderTextColor={colors.muted} value={form.city} onChangeText={(v) => updateField("city", v)} />
      <TextInput style={styles.input} placeholder="Pincode" placeholderTextColor={colors.muted} value={form.pincode} onChangeText={(v) => updateField("pincode", v)} keyboardType="number-pad" />

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: theme.spacing(0.5), marginTop: theme.spacing(1) },
    sectionHint: { fontSize: 12, color: colors.muted, marginBottom: theme.spacing(1) },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1),
      color: colors.text,
      backgroundColor: colors.surface,
    },
    saveButton: { padding: theme.spacing(1.5), alignItems: "center", borderRadius: theme.radius, backgroundColor: colors.primary, marginTop: theme.spacing(1.5) },
    saveButtonText: { color: "#fff", fontWeight: "700" },
  });
