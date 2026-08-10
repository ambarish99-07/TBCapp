import type { OrderStatus, StatusHistoryEntry } from "@tbc/shared-types";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

const STEPS: OrderStatus[] = ["received", "preparing", "out-for-delivery", "delivered"];
const STEP_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  preparing: "Preparing",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

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

  const currentIndex = STEPS.indexOf(status);

  return (
    <View style={styles.wrap}>
      {STEPS.map((step, index) => {
        const isDone = index <= currentIndex;
        const historyEntry = history.find((entry) => entry.status === step);
        return (
          <View key={step} style={styles.step}>
            <View style={[styles.dot, isDone && styles.dotDone]} />
            <View style={styles.stepBody}>
              <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>{STEP_LABELS[step]}</Text>
              {historyEntry && <Text style={styles.timestamp}>{new Date(historyEntry.at).toLocaleString()}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    step: { flexDirection: "row", alignItems: "center", gap: 12 },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
    dotDone: { backgroundColor: colors.primary },
    stepBody: { flex: 1 },
    stepLabel: { fontSize: 14, color: colors.muted },
    stepLabelDone: { color: colors.text, fontWeight: "700" },
    timestamp: { fontSize: 11, color: colors.muted },
    cancelled: { color: colors.danger, fontWeight: "700" },
  });
