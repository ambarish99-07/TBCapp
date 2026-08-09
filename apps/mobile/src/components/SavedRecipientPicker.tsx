import type { SavedRecipient } from "@tbc/shared-types";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

interface Props {
  recipients: SavedRecipient[];
  selectedId: string | null;
  onSelect: (recipient: SavedRecipient) => void;
  onAddNew: () => void;
  onDelete: (id: string) => void;
}

export function SavedRecipientPicker({ recipients, selectedId, onSelect, onAddNew, onDelete }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={{ gap: 8 }}>
      {recipients.map((recipient) => {
        const isSelected = recipient.id === selectedId;
        return (
          <View key={recipient.id} style={[styles.chip, isSelected && styles.chipActive]}>
            <Pressable onPress={() => onSelect(recipient)}>
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{recipient.label}</Text>
            </Pressable>
            <Pressable onPress={() => onDelete(recipient.id)} hitSlop={8}>
              <Text style={[styles.removeText, isSelected && styles.chipTextActive]}> ×</Text>
            </Pressable>
          </View>
        );
      })}
      <Pressable style={styles.addChip} onPress={onAddNew}>
        <Text style={styles.addChipText}>+ Add New</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: theme.spacing(1) },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
  },
  chipActive: { backgroundColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: theme.colors.text },
  chipTextActive: { color: "#fff" },
  removeText: { fontSize: 14, fontWeight: "700", color: theme.colors.muted, marginLeft: 4 },
  addChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  addChipText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
});
