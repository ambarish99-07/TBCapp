import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { createTiffinSubscriptionRequest, useTiffinPlans } from "../../api/tiffin.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import { hasCompleteAddress } from "../../utils/profile";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinCheckout">;

/** Subscribing is a single upfront Cash on Delivery payment in Phase 1 — no live Razorpay
 * credentials configured, same reasoning as the rest of the app's COD path. */
export function TiffinCheckoutScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: plans } = useTiffinPlans();
  const plan = plans?.find((p) => p.id === route.params.planId);
  const user = useAuthStore((state) => state.user);
  const [submitting, setSubmitting] = useState(false);
  const profileComplete = hasCompleteAddress(user);

  async function handleSubscribe() {
    if (!plan || !user || !profileComplete) return;
    setSubmitting(true);
    try {
      const subscription = await createTiffinSubscriptionRequest({
        planId: plan.id,
        sundayVegChoice: route.params.sundayVegChoice,
        delivery: {
          fullName: user.fullName,
          phone: user.phone!,
          address: user.address!,
          houseNumber: user.houseNumber,
          area: user.area,
          landmark: user.landmark,
          city: user.city!,
          pincode: user.pincode!,
        },
      });
      Alert.alert("Subscribed!", `${subscription.subscriptionNumber} — your ${plan.name} is active.`, [
        { text: "View My Tiffin", onPress: () => navigation.replace("MyTiffin") },
      ]);
    } catch (err) {
      Alert.alert("Couldn't subscribe", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!plan) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planMeta}>
          {plan.dietType === "veg" ? "Veg" : "Non-Veg"} · {plan.durationDays} days
          {route.params.sundayVegChoice ? ` · Sunday: ${route.params.sundayVegChoice === "paneer" ? "Paneer Sabzi" : "Chole"}` : ""}
        </Text>
        <Text style={styles.priceRow}>Total: ₹{plan.price}</Text>
      </View>

      <Text style={styles.sectionTitle}>Delivery Address</Text>
      {profileComplete ? (
        <View style={styles.addressCard}>
          <Text style={styles.addressText}>{user!.fullName}</Text>
          <Text style={styles.addressText}>{user!.address}</Text>
          <Text style={styles.addressText}>
            {user!.city}, {user!.pincode}
          </Text>
          <Text style={styles.addressText}>{user!.phone}</Text>
        </View>
      ) : (
        <Pressable style={styles.completeProfileBanner} onPress={() => navigation.navigate("Checkout")}>
          <Text style={styles.completeProfileText}>Complete your profile with a delivery address to subscribe</Text>
          <Text style={styles.completeProfileArrow}>→</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Payment</Text>
      <View style={styles.paymentCard}>
        <Text style={styles.addressText}>Cash on Delivery — pay when your tiffin arrives.</Text>
      </View>

      <Pressable
        style={[styles.subscribeButton, (!profileComplete || submitting) && styles.subscribeButtonDisabled]}
        onPress={handleSubscribe}
        disabled={!profileComplete || submitting}
      >
        <Text style={styles.subscribeButtonText}>{submitting ? "Subscribing…" : `Subscribe & Pay ₹${plan.price}`}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: "center", justifyContent: "center" },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    summaryCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    planName: { fontSize: 17, fontWeight: "800", color: colors.text },
    planMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
    priceRow: { fontSize: 16, fontWeight: "800", color: colors.primary, marginTop: theme.spacing(1) },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(2.5), marginBottom: theme.spacing(1) },
    addressCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(1.5) },
    addressText: { fontSize: 13, color: colors.text, marginTop: 2 },
    paymentCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(1.5) },
    completeProfileBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
    },
    completeProfileText: { flex: 1, fontSize: 12, color: colors.primary, fontWeight: "700" },
    completeProfileArrow: { fontSize: 16, color: colors.primary, fontWeight: "800" },
    subscribeButton: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.75),
      alignItems: "center",
      marginTop: theme.spacing(3),
    },
    subscribeButtonDisabled: { opacity: 0.5 },
    subscribeButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
