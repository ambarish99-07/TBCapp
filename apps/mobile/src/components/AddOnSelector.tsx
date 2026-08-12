import { ADD_ON_PRICES } from "@tbc/pricing";
import { ADD_ONS_BY_CATEGORY, type AddOnId, type MenuCategory } from "@tbc/shared-types";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

const ADD_ON_LABELS: Record<AddOnId, string> = {
  "whipped-cream": "Whipped Cream",
  "extra-chocolate-syrup": "Extra Chocolate Syrup",
  "oreo-crumbs": "Oreo Crumbs",
  "kitkat-crumbs": "KitKat Crumbs",
  "dry-fruits": "Dry Fruits",
  "extra-mint": "Extra Mint",
  "lemon-wedge": "Lemon Wedge",
  "chilli-salt-rim": "Chilli Salt Rim",
  "extra-fizz": "Extra Fizz Top-Up",
  "fruit-garnish": "Fruit Garnish",
};

interface Props {
  category: MenuCategory;
  selected: AddOnId[];
  onChange: (next: AddOnId[]) => void;
  disabled?: boolean;
}

export function AddOnSelector({ category, selected, onChange, disabled }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const addOnIds = ADD_ONS_BY_CATEGORY[category];

  function toggle(id: AddOnId) {
    if (disabled) return;
    onChange(selected.includes(id) ? selected.filter((existing) => existing !== id) : [...selected, id]);
  }

  return (
    <View style={styles.wrap}>
      {addOnIds.map((id) => {
        const isSelected = selected.includes(id);
        return (
          <Pressable
            key={id}
            onPress={() => toggle(id)}
            style={[styles.chip, isSelected && styles.chipSelected, disabled && styles.chipDisabled]}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {ADD_ON_LABELS[id]} (+₹{ADD_ON_PRICES[id]})
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
