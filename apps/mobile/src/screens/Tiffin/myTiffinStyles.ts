import { StyleSheet } from "react-native";
import { theme, type ColorPalette } from "../../constants/theme";

/** Shared between MyTiffinScreen and TiffinSubscriptionAndOrders (embedded inside
 * TiffinSingleMealOrderTrackingScreen) — deliberately has no `screen`/`content` entries since
 * each host screen supplies its own background/ScrollView padding. */
export const makeMyTiffinStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    centered: { alignItems: "center", justifyContent: "center", padding: theme.spacing(3) },
    emptyText: { fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: theme.spacing(2) },
    browseButton: { backgroundColor: colors.primary, borderRadius: theme.radius, paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(3) },
    browseButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    card: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(1.5) },
    planName: { fontSize: 17, fontWeight: "800", color: colors.text },
    meta: { fontSize: 12, color: colors.muted, marginTop: 4 },
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: theme.spacing(1) },
    policyPoint: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 4 },
    skipExplainer: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: theme.spacing(1) },
    nextMealDish: { fontSize: 16, fontWeight: "700", color: colors.primary, marginTop: 4 },
    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: theme.spacing(2) },
    actionButton: { borderWidth: 1, borderColor: colors.border, borderRadius: theme.radius, paddingVertical: 10, paddingHorizontal: 16 },
    actionButtonText: { fontSize: 13, fontWeight: "700", color: colors.text },
    resumeButton: { backgroundColor: colors.primary, borderColor: colors.primary },
    resumeButtonText: { color: "#fff" },
    cancelButton: { borderColor: colors.danger },
    cancelButtonText: { color: colors.danger },
    mealRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mealDate: { fontSize: 12, color: colors.muted },
    mealDish: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 2 },
    addOnsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
    addOnChip: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    addOnChipText: { fontSize: 10, fontWeight: "600", color: colors.muted },
    mealStatus: { fontSize: 12, color: colors.muted, fontWeight: "700" },
    skipButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: theme.radius, paddingVertical: 6, paddingHorizontal: 12 },
    skipButtonText: { fontSize: 12, fontWeight: "700", color: colors.danger },
    skippedGroup: { alignItems: "flex-end", gap: 4 },
    unskipButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: theme.radius, paddingVertical: 4, paddingHorizontal: 10 },
    unskipButtonText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  });
