import type { IceLevel, MenuAddOn, SugarLevel } from "@tbc/shared-types";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";
import { AddOnSelector } from "./AddOnSelector";

const LEVELS: { key: SugarLevel | IceLevel; label: string }[] = [
  { key: "less", label: "Less" },
  { key: "regular", label: "Regular" },
  { key: "extra", label: "Extra" },
];

const COMMENT_MAX_LENGTH = 200;

interface Props {
  /** False for an item with no sugar/ice concept at all (a biryani, a momo plate, ...) — both
   * pickers are skipped entirely rather than showing a meaningless default. */
  hasSugarIceCustomization: boolean;
  sugarLevel: SugarLevel;
  onSugarLevelChange: (level: SugarLevel) => void;
  iceLevel: IceLevel;
  onIceLevelChange: (level: IceLevel) => void;
  /** This item's own already-priced add-ons (see MenuItem.addOns) — empty means no add-ons section at all. */
  availableAddOns: MenuAddOn[];
  addOnIds: string[];
  onAddOnIdsChange: (ids: string[]) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
}

/** Sugar level / ice level / add-ons / free-text comment — shared between the Customize screen and the Cart's "Customize" popup. */
export function CustomizationFields({
  hasSugarIceCustomization,
  sugarLevel,
  onSugarLevelChange,
  iceLevel,
  onIceLevelChange,
  availableAddOns,
  addOnIds,
  onAddOnIdsChange,
  comment,
  onCommentChange,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View>
      {hasSugarIceCustomization && (
        <>
          <Text style={styles.sectionTitle}>Sugar Level</Text>
          <View style={styles.levelRow}>
            {LEVELS.map((level) => (
              <Pressable
                key={level.key}
                onPress={() => onSugarLevelChange(level.key as SugarLevel)}
                style={[styles.levelChip, sugarLevel === level.key && styles.levelChipActive]}
              >
                <Text style={[styles.levelText, sugarLevel === level.key && styles.levelTextActive]}>{level.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Ice Level</Text>
          <View style={styles.levelRow}>
            {LEVELS.map((level) => (
              <Pressable
                key={level.key}
                onPress={() => onIceLevelChange(level.key as IceLevel)}
                style={[styles.levelChip, iceLevel === level.key && styles.levelChipActive]}
              >
                <Text style={[styles.levelText, iceLevel === level.key && styles.levelTextActive]}>{level.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {availableAddOns.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Add-Ons</Text>
          <AddOnSelector availableAddOns={availableAddOns} selected={addOnIds} onChange={onAddOnIdsChange} />
        </>
      )}

      <Text style={styles.sectionTitle}>Comments</Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Any special requests? (e.g. extra hot, no straw)"
        placeholderTextColor={colors.muted}
        value={comment}
        onChangeText={(text) => onCommentChange(text.slice(0, COMMENT_MAX_LENGTH))}
        multiline
        maxLength={COMMENT_MAX_LENGTH}
      />
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: theme.spacing(2), marginBottom: 8 },
    levelRow: { flexDirection: "row", gap: 8 },
    levelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface },
    levelChipActive: { backgroundColor: colors.primary },
    levelText: { fontSize: 12, color: colors.text },
    levelTextActive: { color: "#fff", fontWeight: "700" },
    commentInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      minHeight: 70,
      textAlignVertical: "top",
      color: colors.text,
      fontSize: 13,
    },
  });
