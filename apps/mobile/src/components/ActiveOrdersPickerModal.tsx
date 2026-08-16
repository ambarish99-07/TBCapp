import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DraggableSheet } from "./DraggableSheet";
import { theme, type ColorPalette } from "../constants/theme";
import { useTheme } from "../state/themeStore";

export interface ActiveOrderPickerEntry {
  key: string;
  title: string;
  subtitle: string;
  statusLabel: string;
}

/**
 * Shown instead of jumping straight to an order when more than one is in flight at once — e.g.
 * a TBC order and an Alchemy Tails order placed within minutes of each other. Lets the customer
 * pick which one to check, rather than the app-wide pill silently defaulting to just one.
 */
export function ActiveOrdersPickerModal({
  visible,
  title,
  entries,
  onSelect,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  entries: ActiveOrderPickerEntry[];
  onSelect: (key: string) => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <DraggableSheet onDismiss={onDismiss} sheetStyle={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {entries.map((entry) => (
              <Pressable key={entry.key} style={styles.row} onPress={() => onSelect(entry.key)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{entry.title}</Text>
                  <Text style={styles.rowSubtitle}>{entry.subtitle}</Text>
                </View>
                <Text style={styles.rowStatus}>{entry.statusLabel}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </DraggableSheet>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: theme.radius,
      borderTopRightRadius: theme.radius,
      padding: theme.spacing(2),
      maxHeight: "70%",
    },
    title: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1.5) },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1),
    },
    rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    rowSubtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
    rowStatus: { fontSize: 12, fontWeight: "700", color: colors.primary, marginLeft: theme.spacing(1) },
  });
