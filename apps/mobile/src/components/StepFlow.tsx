import { Fragment, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

export interface StepFlowStep {
  key: string;
  label: string;
  icon: string;
}

const CIRCLE_SIZE = 36;
const LABEL_WIDTH = 72;
const LABEL_GAP = 6;
const LABEL_HEIGHT = 28; // room for up to 2 lines at the label's font size
// Labels sit absolutely-positioned below the circles (so a wide label like "Out for delivery"
// can overflow its narrow circle's column without disturbing the row's flex math), which means
// they don't contribute to the row's own measured height — the row gets an explicit height
// instead, so whatever comes after this component doesn't overlap the labels.
export const STEP_FLOW_HEIGHT = CIRCLE_SIZE + LABEL_GAP + LABEL_HEIGHT;

/**
 * A horizontal step-flow (circle-icon-per-step, connected by a progress line, label below each
 * circle) — shared by the regular order tracking screen and GG Tiffin's single-meal order
 * tracking screen, since both independently track a 4-step "received → preparing → out for
 * delivery → delivered" style status but as two separate order universes (see AGENT.md), each
 * with their own status enum. This component only knows about steps/labels/icons/currentIndex,
 * not which order system it's rendering for.
 */
export function StepFlow({ steps, currentIndex }: { steps: StepFlowStep[]; currentIndex: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.trackRow}>
      {steps.map((step, index) => {
        const isDone = index <= currentIndex;
        return (
          <Fragment key={step.key}>
            {index > 0 && <View style={[styles.connector, isDone && styles.connectorDone]} />}
            <View style={styles.stepColumn}>
              <View style={[styles.circle, isDone && styles.circleDone]}>
                <Text style={[styles.circleIcon, !isDone && styles.circleIconPending]}>{step.icon}</Text>
              </View>
              <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]} numberOfLines={2}>
                {step.label}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    trackRow: { flexDirection: "row", alignItems: "flex-start", height: STEP_FLOW_HEIGHT },
    connector: { flex: 1, height: 3, backgroundColor: colors.border, alignSelf: "center", marginTop: CIRCLE_SIZE / 2 - 1.5, marginHorizontal: -2 },
    connectorDone: { backgroundColor: colors.primary },
    stepColumn: { width: CIRCLE_SIZE, alignItems: "center" },
    circle: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    circleDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    circleIcon: { fontSize: 16 },
    circleIconPending: { opacity: 0.4 },
    stepLabel: {
      position: "absolute",
      top: CIRCLE_SIZE + LABEL_GAP,
      width: LABEL_WIDTH,
      left: (CIRCLE_SIZE - LABEL_WIDTH) / 2,
      textAlign: "center",
      fontSize: 10,
      color: colors.muted,
      fontWeight: "600",
    },
    stepLabelDone: { color: colors.text, fontWeight: "800" },
  });
