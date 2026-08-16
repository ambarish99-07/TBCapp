import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  CANCELLATION_FULL_REFUND_WINDOW_DAYS,
  CANCELLATION_REFUND_PERCENT,
  TIFFIN_PLAN_DURATIONS,
  type TiffinScheduledMeal,
  type TiffinSingleMealOrder,
} from "@tbc/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import {
  cancelTiffinSubscriptionRequest,
  pauseTiffinSubscriptionRequest,
  resumeTiffinSubscriptionRequest,
  skipTiffinMealRequest,
  unskipTiffinMealRequest,
  useMySingleMealOrders,
  useMyTiffinSubscriptions,
  useTiffinUpcomingMeals,
} from "../api/tiffin.api";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";
import type { RootStackParamList } from "../navigation/types";
import { makeMyTiffinStyles } from "../screens/Tiffin/myTiffinStyles";

type Navigation = NativeStackNavigationProp<RootStackParamList, keyof RootStackParamList>;

const MEAL_TYPE_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const TIER_LABELS: Record<string, string> = { regular: "Regular", mini: "Mini Meal", premium: "Premium" };
const DIET_LABELS: Record<string, string> = { veg: "Veg", "non-veg": "Non-Veg" };

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  skipped: "Skipped",
  placed: "Placed",
  preparing: "Preparing",
  "out-for-delivery": "Out for Delivery",
  delivered: "Delivered",
};

/** Shown below the subscription card (or the empty state, if there's no active subscription) —
 * a one-off single-meal order has no skip/pause/cancel actions, just status. Tapping a row opens
 * the full tracking screen (status timeline, delivery map, rider contact, cancellation). */
function SingleMealOrdersSection({
  orders,
  styles,
  navigation,
}: {
  orders: TiffinSingleMealOrder[];
  styles: ReturnType<typeof makeMyTiffinStyles>;
  navigation: Navigation;
}) {
  if (orders.length === 0) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>Recent Single Meal Orders</Text>
      {orders.map((order) => (
        <Pressable
          key={order.id}
          style={styles.mealRow}
          onPress={() => navigation.navigate("TiffinSingleMealOrderTracking", { orderId: order.id })}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.mealDate}>
              {order.date} · {DIET_LABELS[order.dietType] ?? order.dietType} {TIER_LABELS[order.tier] ?? order.tier}{" "}
              {MEAL_TYPE_LABELS[order.mealType] ?? order.mealType}
            </Text>
            <Text style={styles.mealDish}>
              {order.dishName}
              {order.quantity > 1 ? ` × ${order.quantity}` : ""}
            </Text>
            {order.addOns.length > 0 && (
              <View style={styles.addOnsRow}>
                {order.addOns.map((addOn) => (
                  <View key={addOn.name} style={styles.addOnChip}>
                    <Text style={styles.addOnChipText}>
                      {addOn.name} +₹{addOn.price}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <Text style={styles.mealStatus}>{STATUS_LABELS[order.status] ?? order.status}</Text>
        </Pressable>
      ))}
    </>
  );
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Pause presets, not a date picker — no date-picker library is installed, and "pause the next
 * few days" covers the real use case without adding a new dependency for one screen. */
const PAUSE_PRESETS = [3, 7];

/**
 * Everything about a customer's GG Tiffin standing: their active/paused subscription (with
 * pause/resume/cancel and the skip/undo meal list), or the empty "no subscription" prompt, plus
 * every one-off single-meal order they've placed. Used both as MyTiffinScreen's own body and
 * embedded inside TiffinSingleMealOrderTrackingScreen (below that specific order's tracking
 * details), so the "Track Tiffin Order" pill leads somewhere that shows everything, not just the
 * one order — no separate "View My Orders" destination needed. Deliberately has no outer
 * ScrollView/background of its own so it can be embedded inside either screen's.
 */
export function TiffinSubscriptionAndOrders({ navigation }: { navigation: Navigation }) {
  const { colors } = useTheme();
  const styles = makeMyTiffinStyles(colors);
  const queryClient = useQueryClient();
  const { data: subscriptions, isLoading } = useMyTiffinSubscriptions();
  const { data: singleMealOrders } = useMySingleMealOrders();
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

  async function handleUnskip(meal: TiffinScheduledMeal) {
    if (!subscription) return;
    setBusy(true);
    try {
      await unskipTiffinMealRequest(subscription.id, meal.id);
      refresh();
    } catch (err) {
      Alert.alert("Couldn't restore", err instanceof Error ? err.message : "Please try again.");
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

  async function runCancel() {
    if (!subscription) return;
    setBusy(true);
    try {
      const cancelled = await cancelTiffinSubscriptionRequest(subscription.id);
      refresh();
      const refundAmount = cancelled.payment.refundAmount;
      Alert.alert(
        "Subscription cancelled",
        refundAmount ? `₹${refundAmount} will be refunded to you.` : "No refund applies to this cancellation."
      );
    } catch (err) {
      Alert.alert("Couldn't cancel", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    if (!subscription) return;
    const isMonthly = subscription.durationDays === TIFFIN_PLAN_DURATIONS.monthly;
    const daysElapsed = Math.floor((Date.now() - new Date(`${subscription.startDate}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24));
    const withinRefundWindow = isMonthly && daysElapsed < CANCELLATION_FULL_REFUND_WINDOW_DAYS;

    // Full policy, both points — not just whichever one currently applies — so the customer can
    // see the whole picture before deciding whether to cancel now or wait.
    const message = [
      `• Within the first ${CANCELLATION_FULL_REFUND_WINDOW_DAYS} days: ${CANCELLATION_REFUND_PERCENT * 100}% refund.`,
      `• Day ${CANCELLATION_FULL_REFUND_WINDOW_DAYS} or later: no refund.`,
      "",
      withinRefundWindow
        ? `You're within the first ${CANCELLATION_FULL_REFUND_WINDOW_DAYS} days, so you'll get a ${CANCELLATION_REFUND_PERCENT * 100}% refund.`
        : `It's been ${CANCELLATION_FULL_REFUND_WINDOW_DAYS} days or more, so no refund applies.`,
    ].join("\n");

    Alert.alert("Cancel subscription?", message, [
      { text: "Keep Subscription", style: "cancel" },
      { text: "Cancel Subscription", style: "destructive", onPress: runCancel },
    ]);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!subscription) {
    return (
      <>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Ordering a single meal daily, why not get a subscription.</Text>
          <Pressable style={styles.browseButton} onPress={() => navigation.navigate("TiffinLanding")}>
            <Text style={styles.browseButtonText}>Browse Plans</Text>
          </Pressable>
        </View>
        <SingleMealOrdersSection orders={singleMealOrders ?? []} styles={styles} navigation={navigation} />
      </>
    );
  }

  const nextMeal = meals?.find((meal) => meal.status === "scheduled");

  return (
    <>
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
          <Text style={styles.meta}>
            {nextMeal.date} · {MEAL_TYPE_LABELS[nextMeal.mealType] ?? nextMeal.mealType}
          </Text>
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
        {(subscription.status === "active" || subscription.status === "paused") &&
          subscription.durationDays !== TIFFIN_PLAN_DURATIONS.weekly && (
            <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={handleCancel} disabled={busy}>
              <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Cancel Subscription</Text>
            </Pressable>
          )}
      </View>

      {(subscription.status === "active" || subscription.status === "paused") &&
        subscription.durationDays !== TIFFIN_PLAN_DURATIONS.weekly && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cancellation Policy</Text>
            <Text style={styles.policyPoint}>
              • Cancel within the first {CANCELLATION_FULL_REFUND_WINDOW_DAYS} days of your plan starting — get{" "}
              {CANCELLATION_REFUND_PERCENT * 100}% of what you paid refunded.
            </Text>
            <Text style={styles.policyPoint}>
              • Cancel on day {CANCELLATION_FULL_REFUND_WINDOW_DAYS} or later — no refund applies.
            </Text>
          </View>
        )}

      <Text style={styles.sectionTitle}>Upcoming Meals</Text>
      <Text style={styles.skipExplainer}>
        Not going to be home for a meal? Skip it — that day won't be prepared or delivered. Changed your mind? Undo
        brings it back, as long as it's still early enough before that day.
      </Text>
      {(meals ?? []).map((meal) => (
        <View key={meal.id} style={styles.mealRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mealDate}>
              {meal.date} · {MEAL_TYPE_LABELS[meal.mealType] ?? meal.mealType}
            </Text>
            <Text style={styles.mealDish}>{meal.dishName}</Text>
          </View>
          {meal.status === "scheduled" && (
            <Pressable style={styles.skipButton} onPress={() => handleSkip(meal)} disabled={busy}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </Pressable>
          )}
          {meal.status === "skipped" && (
            <View style={styles.skippedGroup}>
              <Text style={styles.mealStatus}>{STATUS_LABELS[meal.status]}</Text>
              <Pressable style={styles.unskipButton} onPress={() => handleUnskip(meal)} disabled={busy}>
                <Text style={styles.unskipButtonText}>Undo</Text>
              </Pressable>
            </View>
          )}
          {meal.status !== "scheduled" && meal.status !== "skipped" && (
            <Text style={styles.mealStatus}>{STATUS_LABELS[meal.status] ?? meal.status}</Text>
          )}
        </View>
      ))}

      <SingleMealOrdersSection orders={singleMealOrders ?? []} styles={styles} navigation={navigation} />
    </>
  );
}
