import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TiffinPlan, TiffinPlanStyle } from "@tbc/shared-types";
import { useMemo } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBrands } from "../../api/brands.api";
import { useTiffinPlans } from "../../api/tiffin.api";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "TiffinLanding">;

function styleMetaLabel(style: TiffinPlanStyle): string {
  if (style === "twice-daily") return "Lunch & Dinner";
  if (style === "thrice-daily") return "Breakfast, Lunch & Dinner";
  return "Breakfast, Lunch, or Dinner";
}

/** GG Tiffin's own front door — deliberately not the shake/mocktail RestaurantMenu tab+list UI:
 * a tiffin service is a couple of weekly/monthly plans, not a menu of many individual items. */
export function TiffinLandingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data: plans, isLoading } = useTiffinPlans();
  const { data: brands } = useBrands();
  const ggTiffinLogoUrl = brands?.find((brand) => brand.id === "gg-tiffin")?.logoUrl;
  const vegPlans = (plans ?? []).filter((plan) => plan.dietType === "veg");
  const nonVegPlans = (plans ?? []).filter((plan) => plan.dietType === "non-veg");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>GG Tiffin Service</Text>
      <Text style={styles.tagline}>Ghar jaise swad, roz ki yaad.</Text>
      <Text style={styles.description}>
        Home-style veg and non-veg meals, delivered daily — breakfast, lunch, dinner, or all three. Subscribe once
        for a week or a month; every day has its own dish. Skip a day whenever you need to, or pause the whole plan
        and resume later.
      </Text>

      <Pressable style={styles.singleMealBanner} onPress={() => navigation.navigate("TiffinSingleMeal")}>
        {ggTiffinLogoUrl ? (
          <Image source={{ uri: ggTiffinLogoUrl }} style={styles.singleMealBannerLogo} resizeMode="cover" />
        ) : (
          <Text style={styles.singleMealBannerEmoji}>🍱</Text>
        )}
        <Text style={styles.singleMealBannerText}>Order a Single Meal — no subscription needed</Text>
        <Text style={styles.singleMealBannerArrow}>→</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Available Plans</Text>
      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: theme.spacing(2) }} />}
      {!isLoading && (!plans || plans.length === 0) && <Text style={styles.info}>No plans available right now — check back shortly!</Text>}

      {(vegPlans.length > 0 || nonVegPlans.length > 0) && (
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.dietSectionTitle}>🟢 Veg</Text>
            {vegPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} styles={styles} onPress={() => navigation.navigate("TiffinPlanSelect", { planId: plan.id })} />
            ))}
          </View>
          <View style={styles.column}>
            <Text style={styles.dietSectionTitle}>🔴 Non-Veg</Text>
            {nonVegPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} styles={styles} onPress={() => navigation.navigate("TiffinPlanSelect", { planId: plan.id })} />
            ))}
          </View>
        </View>
      )}

      <Pressable style={styles.myTiffinLink} onPress={() => navigation.navigate("MyTiffin")}>
        <Text style={styles.myTiffinLinkText}>Already subscribed? View My Tiffin →</Text>
      </Pressable>
    </ScrollView>
  );
}

function PlanCard({ plan, styles, onPress }: { plan: TiffinPlan; styles: ReturnType<typeof makeStyles>; onPress: () => void }) {
  return (
    <Pressable style={styles.planCard} onPress={onPress}>
      {plan.imageUrl && <Image source={{ uri: plan.imageUrl }} style={styles.planImage} resizeMode="cover" />}
      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.planMeta}>
        {plan.durationDays} days · {styleMetaLabel(plan.style)}
      </Text>
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
    singleMealBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: theme.radius,
      padding: theme.spacing(1.5),
      marginTop: theme.spacing(2),
    },
    singleMealBannerLogo: { width: 26, height: 26, borderRadius: 13, marginRight: theme.spacing(1) },
    singleMealBannerEmoji: { fontSize: 18, marginRight: theme.spacing(1) },
    singleMealBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.primary },
    singleMealBannerArrow: { fontSize: 16, fontWeight: "800", color: colors.primary, marginLeft: 8 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: theme.spacing(2.5), marginBottom: theme.spacing(1) },
    dietSectionTitle: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: theme.spacing(1) },
    info: { fontSize: 13, color: colors.muted },
    columns: { flexDirection: "row", gap: theme.spacing(1.5) },
    column: { flex: 1 },
    planCard: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius,
      padding: theme.spacing(1.25),
      marginBottom: theme.spacing(1.25),
      overflow: "hidden",
    },
    planImage: {
      width: "100%",
      aspectRatio: 1.6,
      borderRadius: theme.radius - 4,
      marginBottom: theme.spacing(1),
    },
    planName: { fontSize: 13, fontWeight: "700", color: colors.text },
    planMeta: { fontSize: 11, color: colors.muted, marginTop: 3 },
    planPrice: { fontSize: 15, fontWeight: "800", color: colors.primary, marginTop: theme.spacing(1) },
    myTiffinLink: { marginTop: theme.spacing(2), alignItems: "center" },
    myTiffinLinkText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  });
