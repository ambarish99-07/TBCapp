import { ADD_ON_PRICES, round } from "@tbc/pricing";
import type { AddOnId, IceLevel, MenuItem, SugarLevel } from "@tbc/shared-types";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ColorPalette } from "../constants/theme";
import { useCartStore } from "../state/cartStore";
import { useTheme } from "../state/themeStore";
import { CustomizationFields } from "./CustomizationFields";
import { DraggableSheet } from "./DraggableSheet";

interface Props {
  item: MenuItem | null;
  onClose: () => void;
}

/** Opened by tapping "Add" on a Menu row — the same customize UI as the Checkout "Edit" popup, plus a quantity stepper, since this is adding a brand-new line rather than editing an existing one. */
export function AddItemModal({ item, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const addLine = useCartStore((state) => state.addLine);

  const [sugarLevel, setSugarLevel] = useState<SugarLevel>("regular");
  const [iceLevel, setIceLevel] = useState<IceLevel>("regular");
  const [addOnIds, setAddOnIds] = useState<AddOnId[]>([]);
  const [comment, setComment] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Fresh defaults every time a new item is opened for adding.
  useEffect(() => {
    if (item) {
      setSugarLevel("regular");
      setIceLevel("regular");
      setAddOnIds([]);
      setComment("");
      setQuantity(1);
    }
  }, [item]);

  const visible = item !== null;

  function handleAdd() {
    if (!item) return;
    const effectivePrice = item.salePercent ? round(item.price * (1 - item.salePercent / 100)) : item.price;
    addLine({
      lineId: `${item.id}-${Date.now()}`,
      menuItemId: item.id,
      signatureName: item.signatureName,
      commonName: item.commonName,
      image: item.image,
      unitPrice: effectivePrice,
      originalUnitPrice: item.price,
      addOnPrices: addOnIds.map((id) => ADD_ON_PRICES[id]),
      quantity,
      sugarLevel,
      iceLevel,
      addOnIds,
      comment: comment.trim() || undefined,
      isCombo: false,
      // The 6th/10th-order milestone rewards are TBC-specific (see @tbc/pricing's DrinkCategory) —
      // other brands' items simply don't participate, rather than widening that type to match.
      category: item.category === "signature-shakes" || item.category === "cold-coffee" ? item.category : undefined,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {item && (
          <DraggableSheet onDismiss={onClose} sheetStyle={styles.sheet}>
            {/* Everything scrolls together as one sheet — no separate inner scroll box. */}
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>{item.signatureName}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              <Text style={styles.price}>₹{item.salePercent ? round(item.price * (1 - item.salePercent / 100)) : item.price}</Text>
              <CustomizationFields
                category={item.category}
                sugarLevel={sugarLevel}
                onSugarLevelChange={setSugarLevel}
                iceLevel={iceLevel}
                onIceLevelChange={setIceLevel}
                addOnIds={addOnIds}
                onAddOnIdsChange={setAddOnIds}
                comment={comment}
                onCommentChange={setComment}
              />
              <View style={styles.footerRow}>
                <View style={styles.qtyStepper}>
                  <Pressable style={styles.qtyButton} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
                    <Text style={styles.qtyButtonText}>-</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{quantity}</Text>
                  <Pressable style={styles.qtyButton} onPress={() => setQuantity((q) => Math.min(20, q + 1))}>
                    <Text style={styles.qtyButtonText}>+</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.addButton} onPress={handleAdd}>
                  <Text style={styles.addButtonText}>Add</Text>
                </Pressable>
              </View>
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
      maxHeight: "85%",
    },
    title: { fontSize: 18, fontWeight: "800", color: colors.text },
    description: { fontSize: 12, color: colors.muted, marginTop: 2 },
    price: { fontSize: 15, fontWeight: "700", color: colors.primary, marginTop: 4 },
    // flexShrink lets this shrink to fit the sheet's maxHeight and scroll internally once content
    // overflows, instead of the sheet just growing past its cap (RN's default flexShrink is 0).
    scroll: { flexGrow: 0, flexShrink: 1 },
    footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.spacing(2) },
    qtyStepper: { flexDirection: "row", alignItems: "center", gap: 16 },
    qtyButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
    qtyButtonText: { fontSize: 18, fontWeight: "700", color: colors.text },
    qtyValue: { fontSize: 16, fontWeight: "700", color: colors.text },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.25),
      paddingHorizontal: theme.spacing(3),
      alignItems: "center",
    },
    addButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  });
