import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { submitBulkOrderInquiry } from "../../api/bulkOrders.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "BulkOrder">;

const FEATURES = [
  "🎉 Perfect for parties, offices & celebrations",
  "📦 Custom quantities — no cart limits",
  "💰 Special pricing on large orders",
  "🤝 A dedicated contact to help you plan",
];

export function BulkOrderScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);

  const [name, setName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [occasion, setOccasion] = useState("");
  const [estimatedQuantity, setEstimatedQuantity] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Missing details", "Please share your name and phone number so we can reach you.");
      return;
    }
    setSubmitting(true);
    try {
      await submitBulkOrderInquiry({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        occasion: occasion.trim() || undefined,
        estimatedQuantity: estimatedQuantity.trim() || undefined,
        preferredDate: preferredDate.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      Alert.alert("Couldn't send your request", "Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.successScreen}>
        <Text style={styles.successTitle}>Thanks, {name.split(" ")[0]}! 🎉</Text>
        <Text style={styles.successText}>
          We've got your bulk order request. Our team will reach out to {phone} within 24 hours to work out the details.
        </Text>
        <Pressable style={styles.button} onPress={() => navigation.navigate("Menu")}>
          <Text style={styles.buttonText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen}>
      <Text style={styles.title}>Bulk Orders</Text>
      <Text style={styles.subtitle}>Planning a party, office event, or celebration? We've got you covered.</Text>

      <View style={styles.featureCard}>
        {FEATURES.map((feature) => (
          <Text key={feature} style={styles.featureText}>
            {feature}
          </Text>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Tell Us About Your Order</Text>
      <TextInput style={styles.input} placeholder="Your name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput style={styles.input} placeholder="Occasion (e.g. office party, birthday)" value={occasion} onChangeText={setOccasion} />
      <TextInput
        style={styles.input}
        placeholder="Estimated quantity (e.g. 30 shakes)"
        value={estimatedQuantity}
        onChangeText={setEstimatedQuantity}
      />
      <TextInput style={styles.input} placeholder="Preferred date" value={preferredDate} onChangeText={setPreferredDate} />
      <TextInput
        style={styles.input}
        placeholder="Anything else we should know? (optional)"
        value={message}
        onChangeText={setMessage}
        multiline
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? "Sending…" : "Request a Callback"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2) },
    title: { fontSize: 22, fontWeight: "800", color: colors.primary },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: theme.spacing(2) },
    featureCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(2), gap: 8 },
    featureText: { fontSize: 13, color: colors.text, fontWeight: "600" },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: theme.spacing(1) },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1),
      color: colors.text,
    },
    button: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(2), alignItems: "center", marginVertical: theme.spacing(3) },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    successScreen: { flex: 1, backgroundColor: colors.background, padding: theme.spacing(2), justifyContent: "center", alignItems: "center" },
    successTitle: { fontSize: 22, fontWeight: "800", color: colors.primary, marginBottom: theme.spacing(1), textAlign: "center" },
    successText: { fontSize: 14, color: colors.text, textAlign: "center", marginBottom: theme.spacing(3) },
  });
