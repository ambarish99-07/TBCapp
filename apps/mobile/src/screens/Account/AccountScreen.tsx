import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PREMIUM_ORDER_THRESHOLD, resolveIsPremiumMember } from "@tbc/pricing";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { theme, type ColorPalette } from "../../constants/theme";
import { useAuthStore } from "../../state/authStore";
import { useTheme, type ThemeMode } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

const CONFIRMATION_DURATION_MS = 1700;

type Props = NativeStackScreenProps<RootStackParamList, "Account">;

const MODE_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
];

export function AccountScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [confirmingMode, setConfirmingMode] = useState<ThemeMode | null>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const boltScale = useRef(new Animated.Value(0)).current;
  const boltRotate = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Strobe flash + lightning-bolt burst + screen shake + a buzz, then the
  // "<Mode> Activated" confirmation, then back to the home screen.
  useEffect(() => {
    if (!confirmingMode) return;

    flashAnim.setValue(0);
    boltScale.setValue(0);
    boltRotate.setValue(0);
    shakeAnim.setValue(0);

    Vibration.vibrate([0, 40, 40, 40, 40, 80]);

    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(120),
      Animated.spring(boltScale, { toValue: 1, friction: 3, tension: 140, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(120),
      Animated.timing(boltRotate, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(120),
      Animated.timing(shakeAnim, { toValue: 10, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 35, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 35, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      setConfirmingMode(null);
      navigation.navigate("Menu");
    }, CONFIRMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [confirmingMode, navigation, flashAnim, boltScale, boltRotate, shakeAnim]);

  // An account is required to reach this screen at all (see RootNavigator), so
  // `user` is always set here in practice — this is just for TypeScript.
  if (!user) return null;

  const isPremium = resolveIsPremiumMember(user.loyalty);

  function handleChooseMode(key: ThemeMode) {
    setMode(key);
    setIsAppearanceOpen(false);
    setConfirmingMode(key);
  }

  const currentModeLabel = MODE_OPTIONS.find((option) => option.key === mode)?.label ?? "System";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(2) }}>
        <Pressable style={styles.sectionCard} onPress={() => navigation.navigate("EditProfile")}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Profile</Text>
            <Text style={styles.editText}>Edit</Text>
          </View>
        </Pressable>

        <View style={styles.loyaltyCard}>
          <Text style={styles.loyaltyTier}>{isPremium ? "✨ Premium Member" : "Standard Member"}</Text>
          <Text style={styles.loyaltyMeta}>{user.loyalty.completedOrderCount} orders completed</Text>
          {!isPremium && (
            <Text style={styles.loyaltyMeta}>
              {Math.max(0, PREMIUM_ORDER_THRESHOLD - user.loyalty.completedOrderCount)} more orders to unlock Premium
              Membership (flat 25% off + free delivery within 4km)
            </Text>
          )}
          <Text style={styles.perkNote}>Every 6th order: 50% off a cold coffee</Text>
          <Text style={styles.perkNote}>Every 10th order: a free drink</Text>
        </View>

        <Pressable style={styles.sectionCard} onPress={() => setIsAppearanceOpen(true)}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Appearance</Text>
            <View style={styles.chevronRow}>
              <Text style={styles.currentValue}>{currentModeLabel}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>
        </Pressable>

        <Pressable style={styles.sectionCard} onPress={() => navigation.navigate("OrderHistory")}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Order History</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        <Pressable style={styles.sectionCard} onPress={() => navigation.navigate("MyTiffin")}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>My Tiffin</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </Pressable>
      </View>

      {/* Appearance picker popup */}
      <Modal visible={isAppearanceOpen} animationType="fade" transparent onRequestClose={() => setIsAppearanceOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsAppearanceOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Appearance</Text>
            {MODE_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={[styles.modeOption, mode === option.key && styles.modeOptionActive]}
                onPress={() => handleChooseMode(option.key)}
              >
                <Text style={[styles.modeOptionText, mode === option.key && styles.modeOptionTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Full-screen "<Mode> Activated" confirmation, on top of the newly-applied theme */}
      {confirmingMode && (
        <View style={[styles.confirmationOverlay, { backgroundColor: colors.background }]}>
          <Animated.View style={{ transform: [{ translateX: shakeAnim }], alignItems: "center" }}>
            <Animated.Text
              style={[
                styles.boltIcon,
                {
                  transform: [
                    { scale: boltScale },
                    { rotate: boltRotate.interpolate({ inputRange: [0, 1], outputRange: ["-25deg", "0deg"] }) },
                  ],
                },
              ]}
            >
              ⚡
            </Animated.Text>
            <Text style={styles.confirmationText}>
              {MODE_OPTIONS.find((option) => option.key === confirmingMode)?.label} Mode Activated
            </Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[styles.flashOverlay, { opacity: flashAnim }]} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    sectionCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(1.5) },
    sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
    editText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    chevronRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    currentValue: { fontSize: 13, color: colors.muted },
    chevron: { fontSize: 18, color: colors.muted, fontWeight: "800" },
    loyaltyCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(1.5) },
    loyaltyTier: { fontSize: 16, fontWeight: "800", color: colors.primary },
    loyaltyMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
    perkNote: { fontSize: 12, color: colors.text, marginTop: 6 },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: theme.spacing(2),
      backgroundColor: colors.background,
    },
    logoutButton: { alignItems: "center" },
    logoutButtonText: { color: colors.danger, fontWeight: "700" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: theme.spacing(3) },
    modalCard: { backgroundColor: colors.background, borderRadius: theme.radius, padding: theme.spacing(2) },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: theme.spacing(1.5) },
    modeOption: { padding: theme.spacing(1.5), borderRadius: theme.radius, backgroundColor: colors.surface, alignItems: "center", marginBottom: theme.spacing(1) },
    modeOptionActive: { backgroundColor: colors.primary },
    modeOptionText: { fontSize: 14, color: colors.text, fontWeight: "700" },
    modeOptionTextActive: { color: "#fff" },
    confirmationOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmationText: { fontSize: 22, fontWeight: "800", color: colors.primary },
    boltIcon: { fontSize: 64, marginBottom: theme.spacing(1) },
    flashOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "#FFFFFF",
    },
  });
