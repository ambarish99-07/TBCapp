import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TiffinScheduledMeal } from "@tbc/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  pauseTiffinSubscriptionRequest,
  resumeTiffinSubscriptionRequest,
  skipTiffinMealRequest,
  useMyTiffinSubscriptions,
  useTiffinUpcomingMeals,
} from "../../api/tiffin.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "MyTiffin">;

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  skipped: "Skipped",
  preparing: "Preparing",
  "out-for-delivery": "Out for Delivery",
  delivered: "Delivered",
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Pause presets, not a date picker — no date-picker library is installed, and "pause the next
 * few days" covers the real use case without adding a new dependency for one screen. */
const PAUSE_PRESETS = [3, 7];

export function MyTiffinScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const { data: subscriptions, isLoading } = useMyTiffinSubscriptions();
  const [busy, setBusy] = useState(false);

  // Most recent subscription that's still relevant — active or paused, not completed/cancelled.
  const subscription = subscriptions?.find((sub) => sub.status === "active" || sub.status === "paused");
  const { data: meals } = useTiffinUpcomingMeals(subscription?.id ?? null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["tiffin-subscriptions-mine"] });
    if (subscription) queryClient.invalidateQueries({ queryKey: ["tiffin-meals", subscription.id] });
  }

  async function handleSkip(meal: TiffinScheduledMeal) {
    if (!subscription) return;
    setBusy(true);
    try {
      await skipTiffinMealRequest(subscription.id, meal.id);
      refresh();
    } catch (err) {
      Alert.alert("Couldn't skip", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePause(days: number) {
    if (!subscription) return;
    setBusy(true);
    try {
      const from = new Date();
      from.setUTCDate(from.getUTCDate() + 1);
      const until = new Date(from);
      until.setUTCDate(until.getUTCDate() + (days - 1));
      await pauseTiffinSubscriptionRequest(subscription.id, { from: toIsoDate(from), until: toIsoDate(until) });
      refresh();
    } catch (err) {
      Alert.alert("Couldn't pause", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    if (!subscription) return;
    setBusy(true);
    try {
      await resumeTiffinSubscriptionRequest(subscription.id);
      refresh();
    } catch (err) {
      Alert.alert("Couldn't resume", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!subscription) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.emptyText}>You don't have an active tiffin subscription yet.</Text>
        <Pressable style={styles.browseButton} onPress={() => navigation.navigate("TiffinLanding")}>
          <Text style={styles.browseButtonText}>Browse Plans</Text>
        </Pressable>
      </View>
    );
  }

  const nextMeal = meals?.find((meal) => meal.status === "scheduled");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.planName}>{subscription.planName}</Text>
        <Text style={styles.meta}>
          {STATUS_LABELS[subscription.status] ?? subscription.status} · {subscription.subscriptionNumber}
        </Text>
        <Text style={styles.meta}>
          {subscription.startDate} → {subscription.endDate}
        </Text>
      </View>

      {nextMeal && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Next Meal</Text>
          <Text style={styles.nextMealDish}>{nextMeal.dishName}</Text>
          <Text style={styles.meta}>{nextMeal.date}</Text>
        </View>
      )}

      <View style={styles.actionsRow}>
        {subscription.status === "active" &&
          PAUSE_PRESETS.map((days) => (
            <Pressable key={days} style={styles.actionButton} onPress={() => handlePause(days)} disabled={busy}>
              <Text style={styles.actionButtonText}>Pause {days} days</Text>
            </Pressable>
          ))}
        {subscription.status === "paused" && (
          <Pressable style={[styles.actionButton, styles.resumeButton]} onPress={handleResume} disabled={busy}>
            <Text style={[styles.actionButtonText, styles.resumeButtonText]}>Resume Subscription</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.sectionTitle}>Upcoming Meals</Text>
      {(meals ?? []).map((meal) => (
        <View key={meal.id} style={styles.mealRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mealDate}>{meal.date}</Text>
            <Text style={styles.mealDish}>{meal.dishName}</Text>
          </View>
          {meal.status === "scheduled" ? (
            <Pressable style={styles.skipButton} onPress={() => handleSkip(meal)} disabled={busy}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </Pressable>
          ) : (
            <Text style={styles.mealStatus}>{STATUS_LABELS[meal.status] ?? meal.status}</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing(3) },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: theme.spacing(2) },
    browseButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(3) },
    browseButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    card: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(1.5) },
    planName: { fontSize: 17, fontWeight: "800", color: colors.text },
    meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: theme.spacing(1) },
    nextMealDish: { fontSize: 16, fontWeight: "700", color: colors.primary, marginTop: 4 },
    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: theme.spacing(2) },
    actionButton: { borderWidth: 1, borderColor: colors.border, borderRadius: theme.radius, paddingVertical: 10, paddingHorizontal: 16 },
    actionButtonText: { fontSize: 13, fontWeight: "700", color: colors.text },
    resumeButton: { backgroundColor: colors.primary, borderColor: colors.primary },
    resumeButtonText: { color: "#fff" },
    mealRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mealDate: { fontSize: 12, color: colors.muted },
    mealDish: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 2 },
    mealStatus: { fontSize: 12, color: colors.muted, fontWeight: "700" },
    skipButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: 12 },
    skipButtonText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  });
