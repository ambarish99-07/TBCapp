import type { MenuAddOn } from "@tbc/shared-types";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

interface Props {
  /** This item's own already-priced add-ons (see MenuItem.addOns) — the add-on's `name` doubles
   * as its display label now, no separate kebab-case id + label map to keep in sync. */
  availableAddOns: MenuAddOn[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function AddOnSelector({ availableAddOns, selected, onChange, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function toggle(name: string) {
    if (disabled) return;
    onChange(selected.includes(name) ? selected.filter((existing) => existing !== name) : [...selected, name]);
  }

  return (
    <View style={styles.wrap}>
      {availableAddOns.map((addOn) => {
        const isSelected = selected.includes(addOn.name);
        return (
          <Pressable
            key={addOn.name}
            onPress={() => toggle(addOn.name)}
            style={[styles.chip, isSelected && styles.chipSelected, disabled && styles.chipDisabled]}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {addOn.name} (+₹{addOn.price})
            </Text>
          </Pressable>
        );
      })}
      {disabled && <Text style={styles.note}>Add-ons aren't available on combo items.</Text>}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipDisabled: { opacity: 0.4 },
    chipText: { fontSize: 12, color: colors.text },
    chipTextSelected: { color: "#fff" },
    note: { fontSize: 12, color: colors.muted, marginTop: 4 },
  });
