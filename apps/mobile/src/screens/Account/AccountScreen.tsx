import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PREMIUM_MEMBERSHIP_DURATION_DAYS, PREMIUM_MEMBERSHIP_PRICE } from "@tbc/shared-types";
import { PREMIUM_ORDER_THRESHOLD, resolveIsPremiumMember } from "@tbc/pricing";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { usePremiumMembershipStatus } from "../../api/premiumMembership.api";
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
  const { data: membershipStatus } = usePremiumMembershipStatus({ enabled: !!user });

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

  const isLoyaltyPremium = resolveIsPremiumMember(user.loyalty);
  const ordersToUnlock = Math.max(0, PREMIUM_ORDER_THRESHOLD - user.loyalty.completedOrderCount);
  const loyaltyProgress = Math.min(1, user.loyalty.completedOrderCount / PREMIUM_ORDER_THRESHOLD);
  const contactLine = user.email ?? user.phone ?? "";

  const isMembershipActive = !!membershipStatus?.active;
  const isMembershipExpired = !!membershipStatus && !membershipStatus.active && !!membershipStatus.expiresAt;
  const membershipSubtitle = isMembershipActive
    ? `Active until ${membershipStatus?.expiresAt?.slice(0, 10)}`
    : isMembershipExpired
      ? `Expired on ${membershipStatus?.expiresAt?.slice(0, 10)}`
      : `Free delivery · ₹${PREMIUM_MEMBERSHIP_PRICE}/${PREMIUM_MEMBERSHIP_DURATION_DAYS} days`;

  function handleChooseMode(key: ThemeMode) {
    setMode(key);
    setIsAppearanceOpen(false);
    setConfirmingMode(key);
  }

  const currentModeLabel = MODE_OPTIONS.find((option) => option.key === mode)?.label ?? "System";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(2), paddingBottom: theme.spacing(4) }}>
        {/* Hero identity card */}
        <LinearGradient
          colors={["#0B4F73", "#0B7C8C", "#F2B43C"]}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{user.fullName.trim().charAt(0).toUpperCase() || "?"}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName} numberOfLines={1}>
                {user.fullName}
              </Text>
              {!!contactLine && (
                <Text style={styles.heroContact} numberOfLines={1}>
                  {contactLine}
                </Text>
              )}
              <View style={styles.heroTierPill}>
                <Text style={styles.heroTierPillText}>{isLoyaltyPremium ? "✨ Premium Member" : "Standard Member"}</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.editPill} onPress={() => navigation.navigate("EditProfile")}>
            <Text style={styles.editPillText}>Edit Profile</Text>
            <Text style={styles.editPillChevron}>›</Text>
          </Pressable>
        </LinearGradient>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <Pressable style={styles.statTile} onPress={() => navigation.navigate("OrderHistory")}>
            <Text style={styles.statValue}>{user.loyalty.completedOrderCount}</Text>
            <Text style={styles.statLabel}>Orders Completed</Text>
          </Pressable>
          <Pressable style={styles.statTile} onPress={() => navigation.navigate("PremiumMembership")}>
            <Text style={styles.statValue}>{isMembershipActive ? "👑" : isMembershipExpired ? "⏳" : "—"}</Text>
            <Text style={styles.statLabel}>{isMembershipActive ? "Membership Active" : isMembershipExpired ? "Membership Expired" : "No Membership"}</Text>
          </Pressable>
        </View>

        {/* Loyalty tier progress */}
        {!isLoyaltyPremium && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressTitle}>On your way to Premium</Text>
              <Text style={styles.progressCount}>{user.loyalty.completedOrderCount}/{PREMIUM_ORDER_THRESHOLD}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${loyaltyProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              {ordersToUnlock} more order{ordersToUnlock === 1 ? "" : "s"} to unlock flat 25% off + free delivery within 4km
            </Text>
            <View style={styles.perkRow}>
              <Text style={styles.perkBullet}>🎁</Text>
              <Text style={styles.perkNote}>Every 6th order: 50% off a cold coffee</Text>
            </View>
            <View style={styles.perkRow}>
              <Text style={styles.perkBullet}>🎁</Text>
              <Text style={styles.perkNote}>Every 10th order: a free drink</Text>
            </View>
          </View>
        )}

        {/* Purchased Premium Membership */}
        <Text style={styles.sectionTitle}>Membership</Text>
        <Pressable style={styles.groupCard} onPress={() => navigation.navigate("PremiumMembership")}>
          <View style={styles.rowInner}>
            <Text style={styles.rowIcon}>👑</Text>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabel}>Premium Membership</Text>
              <Text style={styles.rowSubLabel}>{membershipSubtitle}</Text>
            </View>
            {isMembershipExpired ? (
              <View style={styles.renewBadge}>
                <Text style={styles.renewBadgeText}>Renew Now!</Text>
              </View>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </View>
        </Pressable>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.groupCard}>
          <Pressable style={styles.rowInner} onPress={() => setIsAppearanceOpen(true)}>
            <Text style={styles.rowIcon}>🎨</Text>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabel}>Appearance</Text>
            </View>
            <View style={styles.chevronRow}>
              <Text style={styles.currentValue}>{currentModeLabel}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        </View>

        {/* Orders & delivery */}
        <Text style={styles.sectionTitle}>Orders &amp; Delivery</Text>
        <View style={styles.groupCard}>
          <Pressable style={styles.rowInner} onPress={() => navigation.navigate("OrderHistory")}>
            <Text style={styles.rowIcon}>🧾</Text>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabel}>Order History</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.rowInner} onPress={() => navigation.navigate("MyTiffin")}>
            <Text style={styles.rowIcon}>🍱</Text>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabel}>My Tiffin</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.rowInner} onPress={() => navigation.navigate("Addresses")}>
            <Text style={styles.rowIcon}>📍</Text>
            <View style={styles.rowTextBlock}>
              <Text style={styles.rowLabel}>Delivery Address</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
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

    // Hero identity card — same teal-to-gold family as the Home premium card, so a customer's
    // own profile reads as part of the same "premium" visual language rather than a plain form.
    heroCard: {
      borderRadius: theme.radius + 4,
      padding: theme.spacing(2.25),
      marginBottom: theme.spacing(1.5),
    },
    heroTopRow: { flexDirection: "row", alignItems: "center" },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(255,255,255,0.22)",
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.55)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing(1.75),
    },
    avatarInitial: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
    heroInfo: { flex: 1 },
    heroName: { fontSize: 19, fontWeight: "800", color: "#FFFFFF" },
    heroContact: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },
    heroTierPill: {
      alignSelf: "flex-start",
      marginTop: theme.spacing(1),
      backgroundColor: "rgba(0,0,0,0.18)",
      borderRadius: 999,
      paddingVertical: 3,
      paddingHorizontal: 10,
    },
    heroTierPillText: { fontSize: 11, fontWeight: "700", color: "#FFF6DC" },
    editPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      marginTop: theme.spacing(2),
      backgroundColor: "rgba(255,255,255,0.92)",
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: theme.spacing(1.75),
    },
    editPillText: { fontSize: 13, fontWeight: "700", color: "#0B4F73" },
    editPillChevron: { fontSize: 15, fontWeight: "800", color: "#0B4F73", marginLeft: 4 },

    // Quick stats
    statsRow: { flexDirection: "row", gap: theme.spacing(1.5), marginBottom: theme.spacing(1.5) },
    statTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      paddingVertical: theme.spacing(1.75),
      alignItems: "center",
    },
    statValue: { fontSize: 22, fontWeight: "800", color: colors.text },
    statLabel: { fontSize: 11, color: colors.muted, marginTop: 4, textAlign: "center" },

    // Loyalty tier progress
    progressCard: { backgroundColor: colors.surface, borderRadius: theme.radius, padding: theme.spacing(2), marginBottom: theme.spacing(1.5) },
    progressHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    progressTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
    progressCount: { fontSize: 12, fontWeight: "700", color: colors.muted },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: theme.spacing(1), overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
    progressHint: { fontSize: 12, color: colors.muted, marginTop: theme.spacing(1) },
    perkRow: { flexDirection: "row", alignItems: "center", marginTop: theme.spacing(0.75) },
    perkBullet: { fontSize: 13, marginRight: 6 },
    perkNote: { fontSize: 12, color: colors.text },

    // Grouped section list, Zomato/Swiggy-style — one card per section with rows
    // divided by hairlines, rather than a separate box per item.
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing(1),
      marginTop: theme.spacing(0.5),
    },
    groupCard: { backgroundColor: colors.surface, borderRadius: theme.radius, marginBottom: theme.spacing(1.5), overflow: "hidden" },
    rowInner: { flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(1.75) },
    rowIcon: { fontSize: 18, marginRight: theme.spacing(1.5) },
    rowTextBlock: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
    rowSubLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: theme.spacing(1.75) + 18 + theme.spacing(1.5) },
    chevronRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    currentValue: { fontSize: 13, color: colors.muted },
    chevron: { fontSize: 20, color: colors.muted, fontWeight: "800" },
    renewBadge: { backgroundColor: "#E23B3B", borderRadius: 999, paddingVertical: 5, paddingHorizontal: theme.spacing(1.25) },
    renewBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff" },

    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: theme.spacing(2),
      backgroundColor: colors.background,
    },
    logoutButton: {
      alignItems: "center",
      paddingVertical: theme.spacing(1.25),
      borderRadius: theme.radius,
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    logoutButtonText: { color: colors.danger, fontWeight: "800", fontSize: 14 },
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
