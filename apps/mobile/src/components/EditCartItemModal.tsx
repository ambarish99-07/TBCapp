import { round } from "@tbc/pricing";
import type { IceLevel, MenuItem, SugarLevel } from "@tbc/shared-types";
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
  /** The live menu item being customized — carries category-derived concerns (sugar/ice,
   * available add-ons, description) that used to be passed as separate props. Absent for a
   * combo line (combos have no customization at all) or an item since delisted. */
  item: MenuItem | null;
  onClose: () => void;
}

/** The Customize fields, reused as a popup — opened from the Cart's "Customize" link under an already-added item. */
export function EditCartItemModal({ line, item, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const updateLineCustomization = useCartStore((state) => state.updateLineCustomization);

  const [sugarLevel, setSugarLevel] = useState<SugarLevel>("regular");
  const [iceLevel, setIceLevel] = useState<IceLevel>("regular");
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [selectedSizeLabel, setSelectedSizeLabel] = useState<string | undefined>(undefined);

  // Every size this item comes in — see AddItemModal's identical derivation.
  const sizes = useMemo(
    () =>
      item
        ? [
            { label: item.portionSize ?? "Regular", price: item.price, isAvailable: true },
            ...(item.sizeVariants ?? []).map((v) => ({ ...v, isAvailable: v.isAvailable ?? true })),
          ]
        : [],
    [item]
  );

  // Re-seed local state from the line being edited each time a new one opens.
  useEffect(() => {
    if (line && item) {
      setSugarLevel(line.sugarLevel ?? "regular");
      setIceLevel(line.iceLevel ?? "regular");
      setAddOnIds(line.addOnIds);
      setComment(line.comment ?? "");
      setSelectedSizeLabel(line.selectedSizeLabel ?? item.portionSize);
    }
  }, [line, item]);

  const visible = line !== null && item !== null;

  function handleUpdate() {
    if (!line || !item) return;
    const hasSugarIce = item.hasSugarIceCustomization ?? true;
    const sizeBasePrice =
      selectedSizeLabel && selectedSizeLabel !== item.portionSize
        ? ((item.sizeVariants ?? []).find((v) => v.label === selectedSizeLabel)?.price ?? item.price)
        : item.price;
    const unitPrice = item.salePercent ? round(sizeBasePrice * (1 - item.salePercent / 100)) : sizeBasePrice;
    updateLineCustomization(line.lineId, {
      sugarLevel: hasSugarIce ? sugarLevel : undefined,
      iceLevel: hasSugarIce ? iceLevel : undefined,
      addOnIds,
      addOnPrices: addOnIds.map((name) => item.addOns?.find((a) => a.name === name)?.price ?? 0),
      comment: comment.trim(),
      selectedSizeLabel: sizes.length > 1 ? selectedSizeLabel : undefined,
      unitPrice,
      originalUnitPrice: sizeBasePrice,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {line && item && (
          <DraggableSheet onDismiss={onClose} sheetStyle={styles.sheet}>
            {/* Everything scrolls together as one sheet — no separate inner scroll box. */}
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Customize {line.signatureName}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <CustomizationFields
                hasSugarIceCustomization={item.hasSugarIceCustomization ?? true}
                sugarLevel={sugarLevel}
                onSugarLevelChange={setSugarLevel}
                iceLevel={iceLevel}
                onIceLevelChange={setIceLevel}
                sizes={sizes}
                selectedSizeLabel={selectedSizeLabel ?? item.portionSize}
                onSelectedSizeLabelChange={setSelectedSizeLabel}
                availableAddOns={item.addOns ?? []}
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
