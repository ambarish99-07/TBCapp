import type { OrderStatus, StatusHistoryEntry } from "@tbc/shared-types";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

const STEPS: OrderStatus[] = ["received", "preparing", "out-for-delivery", "delivered"];
const STEP_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  preparing: "Preparing",
  "out-for-delivery": "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function StatusTimeline({ status, history }: { status: OrderStatus; history: StatusHistoryEntry[] }) {
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

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.border },
  dotDone: { backgroundColor: theme.colors.primary },
  stepBody: { flex: 1 },
  stepLabel: { fontSize: 14, color: theme.colors.muted },
  stepLabelDone: { color: theme.colors.text, fontWeight: "700" },
  timestamp: { fontSize: 11, color: theme.colors.muted },
  cancelled: { color: theme.colors.danger, fontWeight: "700" },
});
