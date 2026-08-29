import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Feedback, FeedbackCategory } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchFeedbackForOrder, submitFeedbackRequest } from "../../api/feedback.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "OrderFeedback">;

const CATEGORY_OPTIONS: { key: FeedbackCategory; label: string }[] = [
  { key: "wrong-item", label: "Wrong item" },
  { key: "missing-item", label: "Missing item" },
  { key: "late-delivery", label: "Late delivery" },
  { key: "quality-issue", label: "Quality issue" },
  { key: "other", label: "Other" },
];

function formatFeedbackDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** One combined "How was it?" form for a delivered order — a Review tab (star rating + optional
 * comment) and a Report a Problem tab (issue category + optional description), rather than two
 * separate screens the customer has to choose between up front. Checks first whether this order
 * already has feedback and, if so, shows it back read-only instead of the form. */
export function OrderFeedbackScreen({ route }: Props) {
  const { orderId, brandName } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [existing, setExisting] = useState<Feedback | null>(null);
  const [mode, setMode] = useState<"review" | "complaint">("review");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchFeedbackForOrder(orderId)
      .then(setExisting)
      .catch(() => setExisting(null))
      .finally(() => setIsLoading(false));
  }, [orderId]);

  async function handleSubmit() {
    if (mode === "review" && rating === 0) {
      Alert.alert("Add a rating", "Please tap a star to rate your order.");
      return;
    }
    if (mode === "complaint" && !category) {
      Alert.alert("Choose a category", "Please pick what went wrong.");
      return;
    }
    setIsSubmitting(true);
    try {
      const feedback = await submitFeedbackRequest(orderId, {
        isComplaint: mode === "complaint",
        rating: mode === "review" ? rating : undefined,
        category: mode === "complaint" ? (category ?? undefined) : undefined,
        message: message.trim() || undefined,
      });
      setExisting(feedback);
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (existing) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: theme.spacing(2) }}>
        <Text style={styles.thanksTitle}>{existing.type === "review" ? "Thanks for your review!" : "We've received your report"}</Text>
        <Text style={styles.thanksSubtitle}>Submitted on {formatFeedbackDate(existing.createdAt)}</Text>

        <View style={styles.summaryCard}>
          {existing.rating != null && (
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <MaterialCommunityIcons
                  key={n}
                  name={n <= existing.rating! ? "star" : "star-outline"}
                  size={26}
                  color={colors.accent}
                />
              ))}
            </View>
          )}
          {existing.category && (
            <Text style={styles.categoryPillText}>{CATEGORY_OPTIONS.find((c) => c.key === existing.category)?.label}</Text>
          )}
          {existing.message && <Text style={styles.messageText}>"{existing.message}"</Text>}

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusValue}>{existing.status === "open" ? "Received" : existing.status === "in-progress" ? "Being looked into" : "Resolved"}</Text>
          </View>

          {existing.adminResponse && (
            <View style={styles.responseBox}>
              <Text style={styles.responseLabel}>Response from {brandName}</Text>
              <Text style={styles.responseText}>{existing.adminResponse}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: theme.spacing(2) }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>How was your order from {brandName}?</Text>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tab, mode === "review" && styles.tabActive]} onPress={() => setMode("review")}>
          <Text style={[styles.tabText, mode === "review" && styles.tabTextActive]}>⭐ Leave a Review</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === "complaint" && styles.tabActive]} onPress={() => setMode("complaint")}>
          <Text style={[styles.tabText, mode === "complaint" && styles.tabTextActive]}>⚠️ Report a Problem</Text>
        </Pressable>
      </View>

      {mode === "review" ? (
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
              <MaterialCommunityIcons name={n <= rating ? "star" : "star-outline"} size={36} color={colors.accent} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.categoryGrid}>
          {CATEGORY_OPTIONS.map((option) => {
            const isActive = category === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setCategory(option.key)}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <TextInput
        style={styles.messageInput}
        placeholder={mode === "review" ? "Share your experience (optional)" : "Describe what happened (optional)"}
        placeholderTextColor={colors.muted}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
      />

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    title: { fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(2) },
    tabRow: { flexDirection: "row", gap: theme.spacing(1), marginBottom: theme.spacing(2.5) },
    tab: {
      flex: 1,
      paddingVertical: theme.spacing(1.25),
      borderRadius: theme.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: "700", color: colors.text },
    tabTextActive: { color: "#fff" },
    starRow: { flexDirection: "row", justifyContent: "center", gap: theme.spacing(1), marginBottom: theme.spacing(2.5) },
    categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(1), marginBottom: theme.spacing(2) },
    categoryChip: {
      paddingHorizontal: theme.spacing(1.5),
      paddingVertical: theme.spacing(1),
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryChipText: { fontSize: 13, fontWeight: "700", color: colors.text },
    categoryChipTextActive: { color: "#fff" },
    messageInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      minHeight: 90,
      textAlignVertical: "top",
      color: colors.text,
      backgroundColor: colors.surface,
      marginBottom: theme.spacing(2.5),
    },
    submitButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: theme.spacing(1.5), alignItems: "center" },
    submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    thanksTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    thanksSubtitle: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: theme.spacing(2) },
    summaryCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2) },
    categoryPillText: { fontSize: 13, fontWeight: "700", color: colors.primary, textAlign: "center", marginBottom: theme.spacing(1) },
    messageText: { fontSize: 14, color: colors.text, fontStyle: "italic", marginBottom: theme.spacing(1.5) },
    statusRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: theme.spacing(1.25),
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statusLabel: { fontSize: 12, color: colors.muted },
    statusValue: { fontSize: 12, fontWeight: "700", color: colors.text },
    responseBox: { marginTop: theme.spacing(1.5), padding: theme.spacing(1.5), borderRadius: theme.radius, backgroundColor: colors.background },
    responseLabel: { fontSize: 11, fontWeight: "800", color: colors.muted, marginBottom: 4 },
    responseText: { fontSize: 13, color: colors.text },
  });
