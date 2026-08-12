import { useRef } from "react";
import type { ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../state/themeStore";

interface Props {
  onDismiss: () => void;
  children: ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
}

const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.8;
const OFFSCREEN_DISTANCE = 600;

/**
 * Bottom-sheet wrapper with a drag handle at the top. The overlay's existing tap-outside-to-close
 * stays as-is — this adds a second way to dismiss: grab the handle and drag the sheet down.
 */
export function DraggableSheet({ onDismiss, children, sheetStyle }: Props) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) translateY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
          Animated.timing(translateY, { toValue: OFFSCREEN_DISTANCE, duration: 180, useNativeDriver: true }).start(() => {
            translateY.setValue(0);
            onDismiss();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View style={[sheetStyle, { transform: [{ translateY }] }]}>
      <View {...panResponder.panHandlers} style={styles.handleArea}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      </View>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  handleArea: { alignItems: "center", paddingBottom: 8 },
  handle: { width: 40, height: 5, borderRadius: 3 },
});
