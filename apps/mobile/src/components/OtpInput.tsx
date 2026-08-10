import { useMemo, useRef } from "react";
import { StyleSheet, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import type { ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

interface Props {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  autoFocus?: boolean;
  hasError?: boolean;
}

/**
 * Six auto-advancing boxes over one logical code string — the parent owns
 * `value`, this just handles per-box focus/backspace/paste behavior. Typing a
 * digit advances focus; backspace on an empty box steps back and clears the
 * previous one; pasting/autofilling the whole code into any box distributes
 * it across the remaining boxes and fires onComplete once full.
 */
export function OtpInput({ length = 6, value, onChange, onComplete, autoFocus, hasError }: Props) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { colors, radius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, radius), [colors, radius]);

  function setDigit(index: number, text: string) {
    // A paste or platform autofill can deliver more than one character into
    // a single box's onChangeText — distribute it across boxes from here on.
    const digitsOnly = text.replace(/\D/g, "");
    if (digitsOnly.length > 1) {
      const next = (value.slice(0, index) + digitsOnly).slice(0, length);
      onChange(next);
      if (next.length >= length) {
        inputRefs.current[length - 1]?.blur();
        onComplete?.(next);
      } else {
        inputRefs.current[next.length]?.focus();
      }
      return;
    }

    const chars = value.split("");
    chars[index] = digitsOnly;
    const next = chars.join("").slice(0, length);
    onChange(next);

    if (digitsOnly && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.length >= length && next.split("").every(Boolean)) {
      inputRefs.current[index]?.blur();
      onComplete?.(next);
    }
  }

  function handleKeyPress(index: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === "Backspace" && !value[index] && index > 0) {
      const chars = value.split("");
      chars[index - 1] = "";
      onChange(chars.join(""));
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          style={[styles.box, hasError && styles.boxError]}
          value={value[index] ?? ""}
          onChangeText={(text) => setDigit(index, text)}
          onKeyPress={(e) => handleKeyPress(index, e)}
          keyboardType="number-pad"
          maxLength={length} // generous, not 1 — lets a paste land fully in one box
          textContentType="oneTimeCode"
          autoFocus={autoFocus && index === 0}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: ColorPalette, radius: number) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: 8, justifyContent: "center" },
    box: {
      width: 44,
      height: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
    },
    boxError: { borderColor: colors.danger },
  });
