import type { OrderStatus, StatusHistoryEntry } from "@tbc/shared-types";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";
import { StepFlow, type StepFlowStep } from "./StepFlow";

const STEPS: StepFlowStep[] = [
  { key: "received", label: "Order Placed", icon: "🧾" },
  { key: "preparing", label: "Preparing", icon: "🍳" },
  { key: "out-for-delivery", label: "Out for delivery", icon: "🛵" },
  { key: "delivered", label: "Delivered", icon: "✅" },
];

export function StatusTimeline({ status, history }: { status: OrderStatus; history: StatusHistoryEntry[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (status === "cancelled") {
    return (
      <View style={styles.wrap}>
        <Text style={styles.cancelled}>This order was cancelled.</Text>
      </View>
    );
  }

  const currentIndex = STEPS.findIndex((step) => step.key === status);
  const currentHistoryEntry = history.find((entry) => entry.status === status);

  return (
    <View style={styles.wrap}>
      <StepFlow steps={STEPS} currentIndex={currentIndex} />
      {/* The current step's own timestamp is the one detail worth surfacing inline — the full
          history list isn't shown per-step anymore now that the flow reads left-to-right rather
          than as a vertical log, but "when did it last move" is still useful at a glance. */}
      {currentHistoryEntry && <Text style={styles.currentTimestamp}>Updated {new Date(currentHistoryEntry.at).toLocaleString()}</Text>}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrap: {},
    currentTimestamp: { fontSize: 11, color: colors.muted, textAlign: "center" },
    cancelled: { color: colors.danger, fontWeight: "700" },
  });
