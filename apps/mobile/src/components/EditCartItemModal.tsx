import type { AddOnId, IceLevel, MenuCategory, SugarLevel } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import type { CartLine } from "../state/cartStore";
import { useCartStore } from "../state/cartStore";
import { useTheme } from "../state/themeStore";
import { CustomizationFields } from "./CustomizationFields";
import { DraggableSheet } from "./DraggableSheet";

interface Props {
  line: CartLine | null;
  category: MenuCategory | null;
  /** Absent for combo lines — combos don't carry a menu item description. */
  description?: string;
  onClose: () => void;
}

/** The Customize fields, reused as a popup — opened from the Cart's "Customize" link under an already-added item. */
export function EditCartItemModal({ line, category, description, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const updateLineCustomization = useCartStore((state) => state.updateLineCustomization);

  const [sugarLevel, setSugarLevel] = useState<SugarLevel>("regular");
  const [iceLevel, setIceLevel] = useState<IceLevel>("regular");
  const [addOnIds, setAddOnIds] = useState<AddOnId[]>([]);
  const [comment, setComment] = useState("");

  // Re-seed local state from the line being edited each time a new one opens.
  useEffect(() => {
    if (line) {
      setSugarLevel(line.sugarLevel);
      setIceLevel(line.iceLevel);
      setAddOnIds(line.addOnIds);
      setComment(line.comment ?? "");
    }
  }, [line]);

  const visible = line !== null && category !== null;

  function handleUpdate() {
    if (!line) return;
    updateLineCustomization(line.lineId, { sugarLevel, iceLevel, addOnIds, comment: comment.trim() });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {line && category && (
          <DraggableSheet onDismiss={onClose} sheetStyle={styles.sheet}>
            {/* Everything scrolls together as one sheet — no separate inner scroll box. */}
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Customize {line.signatureName}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
              <CustomizationFields
                category={category}
                sugarLevel={sugarLevel}
                onSugarLevelChange={setSugarLevel}
                iceLevel={iceLevel}
                onIceLevelChange={setIceLevel}
                addOnIds={addOnIds}
                onAddOnIdsChange={setAddOnIds}
                comment={comment}
                onCommentChange={setComment}
              />
              <Pressable style={styles.updateButton} onPress={handleUpdate}>
                <Text style={styles.updateButtonText}>Update Item</Text>
              </Pressable>
            </ScrollView>
          </DraggableSheet>
        )}
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
      maxHeight: "80%",
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    description: { fontSize: 12, color: colors.muted, marginTop: 2 },
    // flexShrink lets this shrink to fit the sheet's maxHeight and scroll internally once content
    // overflows, instead of the sheet just growing past its cap (RN's default flexShrink is 0).
    scroll: { flexGrow: 0, flexShrink: 1 },
    updateButton: { backgroundColor: colors.primary, borderRadius: theme.radius, padding: theme.spacing(1.75), alignItems: "center", marginTop: theme.spacing(2) },
    updateButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
