import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TiffinPlan } from "@tbc/shared-types";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTiffinPlans } from "../../api/tiffin.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinLanding">;

/** GG Tiffin's own front door — deliberately not the shake/mocktail RestaurantMenu tab+list UI:
 * a tiffin service is a couple of weekly/monthly plans, not a menu of many individual items. */
export function TiffinLandingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: plans, isLoading } = useTiffinPlans();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>GG Tiffin Service</Text>
      <Text style={styles.tagline}>Ghar jaise swad, roz ki yaad.</Text>
      <Text style={styles.description}>
        Home-style veg and non-veg lunch, delivered daily. Subscribe once for a week or a month — every day has its
        own dish, with a Sunday special. Skip a day whenever you need to, or pause the whole plan and resume later.
      </Text>

      <Text style={styles.sectionTitle}>Available Plans</Text>
      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: theme.spacing(2) }} />}
      {!isLoading && (!plans || plans.length === 0) && <Text style={styles.info}>No plans available right now — check back shortly!</Text>}

      {(plans ?? []).map((plan) => (
        <PlanCard key={plan.id} plan={plan} styles={styles} onPress={() => navigation.navigate("TiffinPlanSelect", { planId: plan.id })} />
      ))}

      <Pressable style={styles.myTiffinLink} onPress={() => navigation.navigate("MyTiffin")}>
        <Text style={styles.myTiffinLinkText}>Already subscribed? View My Tiffin →</Text>
      </Pressable>
    </ScrollView>
  );
}

function PlanCard({ plan, styles, onPress }: { plan: TiffinPlan; styles: ReturnType<typeof makeStyles>; onPress: () => void }) {
  return (
    <Pressable style={styles.planCard} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planMeta}>
          {plan.dietType === "veg" ? "Veg" : "Non-Veg"} · {plan.durationDays} days ·{" "}
          {plan.style === "twice-daily" ? "Lunch & Dinner" : "Lunch or Dinner"}
        </Text>
      </View>
      <Text style={styles.planPrice}>₹{plan.price}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    title: { fontSize: 22, fontWeight: "800", color: colors.text },
    tagline: { fontSize: 13, color: colors.muted, marginTop: 4 },
    description: { fontSize: 13, color: colors.text, marginTop: theme.spacing(1.5), lineHeight: 19 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: theme.spacing(2.5), marginBottom: theme.spacing(1) },
    info: { fontSize: 13, color: colors.muted },
    planCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginBottom: theme.spacing(1.25),
    },
    planName: { fontSize: 15, fontWeight: "700", color: colors.text },
    planMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
    planPrice: { fontSize: 16, fontWeight: "800", color: colors.primary },
    myTiffinLink: { marginTop: theme.spacing(2), alignItems: "center" },
    myTiffinLinkText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  });
