import "dotenv/config";
import { CROSS_BRAND_ID, TIFFIN_PLAN_DURATIONS } from "@tbc/shared-types";
import { loadEnv } from "../config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "./connection.js";
import { BrandModel } from "./models/Brand.model.js";
import { MenuItemModel } from "./models/MenuItem.model.js";
import { ComboModel } from "./models/Combo.model.js";
import { TiffinMealPriceModel } from "./models/TiffinMealPrice.model.js";
import { TiffinPlanModel } from "./models/TiffinPlan.model.js";
import { TiffinScheduledMealModel } from "./models/TiffinScheduledMeal.model.js";
import { TiffinSingleMealOrderModel } from "./models/TiffinSingleMealOrder.model.js";
import { TiffinSubscriptionModel } from "./models/TiffinSubscription.model.js";

const TBC_BRAND_ID = "tbc";
const ALCHEMY_TAILS_BRAND_ID = "alchemy-tails";

/** Real menu photography, served by this API at /menu-images/<slug>.png (see app.ts). */
function imageUrl(env: ReturnType<typeof loadEnv>, slug: string): string {
  return `http://localhost:${env.PORT}/menu-images/${slug}.png`;
}

/** Brand logo artwork, served at /brand-images/<slug>.png (see app.ts). */
function brandLogoUrl(env: ReturnType<typeof loadEnv>, slug: string): string {
  return `http://localhost:${env.PORT}/brand-images/${slug}.png`;
}

// Bumped whenever the hero photo files themselves change on disk — the filename
// stays the same, so without this the mobile Image cache would keep showing a
// stale version after a reload even though the file on disk is now different.
const HERO_IMAGE_VERSION = 3;

/** Wide lifestyle/product photo for the carousel hero, served at /brand-images/<slug>-hero.png. */
function brandHeroUrl(env: ReturnType<typeof loadEnv>, slug: string): string {
  return `http://localhost:${env.PORT}/brand-images/${slug}-hero.png?v=${HERO_IMAGE_VERSION}`;
}

/** Tiffin plan-card thumbnail, served at /tiffin-images/<slug>.png. */
function tiffinImageUrl(env: ReturnType<typeof loadEnv>, slug: string): string {
  return `http://localhost:${env.PORT}/tiffin-images/${slug}.png`;
}

function buildBrands(env: ReturnType<typeof loadEnv>) {
  return [
    {
      _id: TBC_BRAND_ID,
      name: "The Blenders Club",
      tagline: "Shakes, good vibes, great times.",
      status: "live" as const,
      logoUrl: brandLogoUrl(env, "tbc"),
      heroImageUrl: brandHeroUrl(env, "tbc"),
      primaryColor: "#6B3F2A",
      accentColor: "#D98E4A",
    },
    {
      _id: "alchemy-tails",
      name: "The Alchemy Tails",
      tagline: "Crafted Mixes. Magical Experiences.",
      status: "live" as const,
      logoUrl: brandLogoUrl(env, "alchemy-tails"),
      heroImageUrl: brandHeroUrl(env, "alchemy-tails"),
      primaryColor: "#8A6D1F",
      accentColor: "#C9A227",
    },
    {
      _id: "gg-tiffin",
      name: "GG Tiffin Service",
      tagline: "Ghar jaise swad, roz ki yaad.",
      status: "live" as const,
      logoUrl: brandLogoUrl(env, "gg-tiffin"),
      heroImageUrl: brandHeroUrl(env, "gg-tiffin"),
      primaryColor: "#7A5A22",
      accentColor: "#B8860B",
    },
  ];
}

function buildTbcMenuItems(env: ReturnType<typeof loadEnv>) {
  return [
    {
      _id: "choco-crush",
      signatureName: "Choco Crush",
      commonName: "Rich Chocolate Shake",
      description: "A rich, indulgent chocolate shake topped with cocoa curls and a chocolate wafer stick.",
      price: 199,
      category: "signature-shakes",
      image: imageUrl(env, "choco-crush"),
      flavorBadges: ["Chocolate Lover"],
      isPopular: true,
      isStaffPick: true,
      pairsWith: ["hazelnut-heaven"],
    },
    {
      _id: "cookie-crush",
      signatureName: "Cookie Crush",
      commonName: "Cookies & Cream Shake",
      description: "A creamy cookies-and-cream shake loaded with chocolate sandwich cookies.",
      price: 219,
      category: "signature-shakes",
      image: imageUrl(env, "cookie-crush"),
      flavorBadges: ["Chocolate Lover"],
      pairsWith: ["wafer-wonder"],
    },
    {
      _id: "golden-crunch",
      signatureName: "Golden Crunch",
      commonName: "Salted Caramel Praline Shake",
      description: "A golden caramel shake with a praline crunch and a drizzle of salted caramel.",
      price: 229,
      category: "signature-shakes",
      image: imageUrl(env, "golden-crunch"),
      flavorBadges: ["Nutty", "Classic"],
      pairsWith: ["caramel-bliss"],
    },
    {
      _id: "saffron-gold",
      signatureName: "Saffron Gold",
      commonName: "Saffron Pistachio Shake",
      description: "A fragrant saffron shake finished with pistachios and a hint of cardamom.",
      price: 249,
      category: "signature-shakes",
      image: imageUrl(env, "saffron-gold"),
      flavorBadges: ["Signature", "Nutty"],
      isStaffPick: true,
    },
    {
      _id: "hazelnut-heaven",
      signatureName: "Hazelnut Heaven",
      commonName: "Chocolate Hazelnut Shake",
      description: "A velvety chocolate-hazelnut shake topped with roasted hazelnuts and chocolate lace.",
      price: 229,
      category: "signature-shakes",
      image: imageUrl(env, "hazelnut-heaven"),
      flavorBadges: ["Chocolate Lover", "Nutty"],
      pairsWith: ["choco-crush"],
      isStaffPick: true,
    },
    {
      _id: "choco-crunch-blast",
      signatureName: "Choco Crunch Blast",
      commonName: "Chocolate Cookie Shake",
      description: "An extra-loaded chocolate shake with cookies, hazelnuts, and a chocolate wafer.",
      price: 249,
      category: "signature-shakes",
      image: imageUrl(env, "choco-crunch-blast"),
      flavorBadges: ["Chocolate Lover"],
      isPopular: true,
      isStaffPick: true,
    },
    {
      _id: "caramel-bliss",
      signatureName: "Caramel Bliss",
      commonName: "Salted Caramel Shake",
      description: "A smooth caramel shake with soft caramel cubes and a spun-sugar garnish.",
      price: 219,
      category: "signature-shakes",
      image: imageUrl(env, "caramel-bliss"),
      flavorBadges: ["Classic"],
      pairsWith: ["golden-crunch"],
    },
    {
      _id: "vanilla-dream",
      signatureName: "Vanilla Dream",
      commonName: "Classic Vanilla Bean Shake",
      description: "A classic vanilla bean shake, simple and smooth, finished with real vanilla pods.",
      price: 179,
      category: "signature-shakes",
      image: imageUrl(env, "vanilla-dream"),
      flavorBadges: ["Classic"],
      pairsWith: ["berry-bloom"],
    },
    {
      _id: "berry-bloom",
      signatureName: "Berry Bloom",
      commonName: "Strawberry Shake",
      description: "A sweet strawberry shake swirled with fresh strawberries and whipped cream.",
      price: 229,
      category: "signature-shakes",
      image: imageUrl(env, "berry-bloom"),
      flavorBadges: ["Fruity"],
      pairsWith: ["vanilla-dream"],
    },
    {
      _id: "mango-magic",
      signatureName: "Mango Magic",
      commonName: "Mango Shake",
      description: "A fresh, fruity mango shake topped with ripe mango slices and toasted coconut.",
      price: 199,
      category: "signature-shakes",
      image: imageUrl(env, "mango-magic"),
      flavorBadges: ["Fruity"],
      isNew: true,
      pairsWith: ["banana-bliss"],
    },
    {
      _id: "banana-bliss",
      signatureName: "Banana Bliss",
      commonName: "Banana Shake",
      description: "A creamy banana shake topped with fresh banana slices and a cookie stick.",
      price: 179,
      category: "signature-shakes",
      image: imageUrl(env, "banana-bliss"),
      flavorBadges: ["Fruity"],
      pairsWith: ["mango-magic"],
    },
    {
      _id: "wafer-wonder",
      signatureName: "Wafer Wonder",
      commonName: "Chocolate Wafer Shake",
      description: "A rich chocolate shake topped with whipped cream and chocolate wafer bars.",
      price: 229,
      category: "signature-shakes",
      image: imageUrl(env, "wafer-wonder"),
      flavorBadges: ["Chocolate Lover"],
      pairsWith: ["cookie-crush"],
    },
    {
      _id: "coffee-chill",
      signatureName: "Coffee Chill",
      commonName: "Classic Iced Coffee",
      description: "A classic iced coffee over ice with a light layer of cold foam.",
      price: 189,
      category: "cold-coffee",
      image: imageUrl(env, "coffee-chill"),
      flavorBadges: ["Coffee Favorite", "Classic"],
      isPopular: true,
    },
    {
      _id: "mocha-magic",
      signatureName: "Mocha Magic",
      commonName: "Iced Mocha",
      description: "A rich iced mocha layered with cream and chocolate drizzle.",
      price: 209,
      category: "cold-coffee",
      image: imageUrl(env, "mocha-magic"),
      flavorBadges: ["Coffee Favorite", "Chocolate Lover"],
    },
    {
      _id: "caramel-brew",
      signatureName: "Caramel Brew",
      commonName: "Iced Caramel Coffee",
      description: "A smooth iced caramel coffee finished with whipped cream and a caramel drizzle.",
      price: 209,
      category: "cold-coffee",
      image: imageUrl(env, "caramel-brew"),
      flavorBadges: ["Coffee Favorite"],
      isStaffPick: true,
    },
  ];
}

/** All curated combos are exactly two items — price is always computed live as 15% off the pair's base prices, never stored here. */
function buildTbcCombos(env: ReturnType<typeof loadEnv>, allItemIds: string[]) {
  return [
    {
      _id: "choco-hazelnut-duo",
      type: "curated",
      name: "Choco Hazelnut Duo",
      description: "Choco Crush + Hazelnut Heaven together.",
      itemIds: ["choco-crush", "hazelnut-heaven"],
      image: imageUrl(env, "choco-crush"),
    },
    {
      _id: "cookies-and-wafers",
      type: "curated",
      name: "Cookies & Wafers",
      description: "Cookie Crush + Wafer Wonder together.",
      itemIds: ["cookie-crush", "wafer-wonder"],
      image: imageUrl(env, "cookie-crush"),
    },
    {
      _id: "tropical-bliss",
      type: "curated",
      name: "Tropical Bliss",
      description: "Mango Magic + Banana Bliss together.",
      itemIds: ["mango-magic", "banana-bliss"],
      image: imageUrl(env, "mango-magic"),
    },
    {
      _id: "caramel-gold-rush",
      type: "curated",
      name: "Caramel Gold Rush",
      description: "Caramel Bliss + Golden Crunch together.",
      itemIds: ["caramel-bliss", "golden-crunch"],
      image: imageUrl(env, "caramel-bliss"),
    },
    {
      _id: "berry-vanilla-delight",
      type: "curated",
      name: "Berry Vanilla Delight",
      description: "Berry Bloom + Vanilla Dream together.",
      itemIds: ["berry-bloom", "vanilla-dream"],
      image: imageUrl(env, "berry-bloom"),
    },
    {
      _id: "choose-your-own-2",
      type: "choose-n",
      name: "Choose Your Own Duo",
      description: "Pick any 2 items from the full menu — priced at 15% off their combined price.",
      chooseCount: 2,
      eligibleItemIds: allItemIds,
    },
  ];
}

function buildAlchemyTailsMenuItems(env: ReturnType<typeof loadEnv>) {
  return [
    {
      _id: "berry-blast",
      signatureName: "Berry Blast",
      commonName: "Mixed Berry Mocktail",
      description: "A vibrant burst of mixed berries shaken with soda and a hint of mint.",
      price: 179,
      category: "mocktails",
      image: imageUrl(env, "berry-blast"),
      flavorBadges: ["Fruity", "Berry"],
    },
    {
      _id: "blue-lagoon",
      signatureName: "Blue Lagoon",
      commonName: "Blue Curacao Mocktail",
      description: "A dreamy blue mocktail with citrus and a splash of lemonade, served over ice.",
      price: 149,
      category: "mocktails",
      image: imageUrl(env, "blue-lagoon"),
      flavorBadges: ["Citrus", "Signature"],
      isStaffPick: true,
    },
    {
      _id: "green-apple-fizz",
      signatureName: "Green Apple Fizz",
      commonName: "Green Apple Soda",
      description: "Crisp green apple syrup topped with soda for a tangy, refreshing sip.",
      price: 169,
      category: "mocktails",
      image: imageUrl(env, "green-apple-fizz"),
      flavorBadges: ["Fruity", "Classic"],
    },
    {
      _id: "guava-chilli-fizz",
      signatureName: "Guava Chilli Fizz",
      commonName: "Spiced Guava Fizz",
      description: "Sweet guava with a fiery chilli kick, balanced with lime and soda.",
      price: 159,
      category: "mocktails",
      image: imageUrl(env, "guava-chilli-fizz"),
      flavorBadges: ["Spicy", "Tangy"],
      isNew: true,
    },
    {
      _id: "kala-khatta-fizz",
      signatureName: "Kala Khatta Fizz",
      commonName: "Black Salt Plum Fizz",
      description: "The classic Indian kala khatta flavor with a tangy black salt finish.",
      price: 149,
      category: "mocktails",
      image: imageUrl(env, "kala-khatta-fizz"),
      flavorBadges: ["Tangy", "Desi"],
    },
    {
      _id: "litchi-lemon-fizz",
      signatureName: "Litchi Lemon Fizz",
      commonName: "Lychee Lemon Fizz",
      description: "Sweet lychee balanced with zesty lemon and a fizzy finish.",
      price: 159,
      category: "mocktails",
      image: imageUrl(env, "litchi-lemon-fizz"),
      flavorBadges: ["Fruity", "Citrus"],
      pairsWith: ["rose-lemonade"],
    },
    {
      _id: "mango-mojito",
      signatureName: "Mango Mojito",
      commonName: "Mango Mint Mojito",
      description: "Fresh mango pulp muddled with mint and lime over crushed ice.",
      price: 159,
      category: "mocktails",
      image: imageUrl(env, "mango-mojito"),
      flavorBadges: ["Fruity", "Minty"],
      isPopular: true,
      pairsWith: ["watermelon-mojito"],
    },
    {
      _id: "pina-colada",
      signatureName: "Pina Colada",
      commonName: "Pineapple Coconut Mocktail",
      description: "A creamy blend of pineapple and coconut — a tropical classic.",
      price: 189,
      category: "mocktails",
      image: imageUrl(env, "pina-colada"),
      flavorBadges: ["Tropical", "Creamy"],
      isStaffPick: true,
    },
    {
      _id: "pineapple-punch",
      signatureName: "Pineapple Punch",
      commonName: "Pineapple Ginger Punch",
      description: "Sweet pineapple juice with a subtle ginger kick and soda.",
      price: 189,
      category: "mocktails",
      image: imageUrl(env, "pineapple-punch"),
      flavorBadges: ["Tropical", "Tangy"],
      pairsWith: ["pina-colada"],
      isStaffPick: true,
    },
    {
      _id: "rainbow-fizz",
      signatureName: "Rainbow Fizz",
      commonName: "Layered Fruit Fizz",
      description: "A layered, colorful mix of fruit syrups topped with soda.",
      price: 199,
      category: "mocktails",
      image: imageUrl(env, "rainbow-fizz"),
      flavorBadges: ["Fruity", "Signature"],
      isNew: true,
      isPopular: true,
      isStaffPick: true,
    },
    {
      _id: "rose-lemonade",
      signatureName: "Rose Lemonade",
      commonName: "Rose Petal Lemonade",
      description: "Fragrant rose syrup with fresh lemonade, light and floral.",
      price: 179,
      category: "mocktails",
      image: imageUrl(env, "rose-lemonade"),
      flavorBadges: ["Floral", "Citrus"],
      pairsWith: ["litchi-lemon-fizz"],
    },
    {
      _id: "shirley-temple",
      signatureName: "Shirley Temple",
      commonName: "Grenadine Ginger Ale",
      description: "A classic grenadine and ginger ale mocktail with a maraschino cherry.",
      price: 169,
      category: "mocktails",
      image: imageUrl(env, "shirley-temple"),
      flavorBadges: ["Classic", "Sweet"],
    },
    {
      _id: "strawberry-mojito",
      signatureName: "Strawberry Mojito",
      commonName: "Strawberry Mint Mojito",
      description: "Muddled strawberries with fresh mint and lime over crushed ice.",
      price: 149,
      category: "mocktails",
      image: imageUrl(env, "strawberry-mojito"),
      flavorBadges: ["Fruity", "Minty"],
      isPopular: true,
      pairsWith: ["virgin-mojito"],
    },
    {
      _id: "virgin-mojito",
      signatureName: "Virgin Mojito",
      commonName: "Classic Virgin Mojito",
      description: "The classic mojito — mint, lime, and soda, alcohol-free.",
      price: 129,
      category: "mocktails",
      image: imageUrl(env, "virgin-mojito"),
      flavorBadges: ["Classic", "Minty"],
      isStaffPick: true,
      pairsWith: ["strawberry-mojito"],
    },
    {
      _id: "watermelon-mojito",
      signatureName: "Watermelon Mojito",
      commonName: "Watermelon Mint Mojito",
      description: "Fresh watermelon juice muddled with mint and lime.",
      price: 139,
      category: "mocktails",
      image: imageUrl(env, "watermelon-mojito"),
      flavorBadges: ["Fruity", "Minty"],
      isNew: true,
      pairsWith: ["mango-mojito"],
    },
  ];
}

/** Same shape as buildTbcCombos — curated duos plus one choose-your-own. */
function buildAlchemyTailsCombos(env: ReturnType<typeof loadEnv>, allItemIds: string[]) {
  return [
    {
      _id: "tropical-duo",
      type: "curated",
      name: "Tropical Duo",
      description: "Pina Colada + Watermelon Mojito together.",
      itemIds: ["pina-colada", "watermelon-mojito"],
      image: imageUrl(env, "pina-colada"),
    },
    {
      _id: "citrus-duo",
      type: "curated",
      name: "Citrus Duo",
      description: "Rose Lemonade + Litchi Lemon Fizz together.",
      itemIds: ["rose-lemonade", "litchi-lemon-fizz"],
      image: imageUrl(env, "rose-lemonade"),
    },
    {
      _id: "mojito-duo",
      type: "curated",
      name: "Mojito Duo",
      description: "Strawberry Mojito + Mango Mojito together.",
      itemIds: ["strawberry-mojito", "mango-mojito"],
      image: imageUrl(env, "strawberry-mojito"),
    },
    {
      _id: "spicy-fizz-duo",
      type: "curated",
      name: "Spicy Fizz Duo",
      description: "Guava Chilli Fizz + Kala Khatta Fizz together.",
      itemIds: ["guava-chilli-fizz", "kala-khatta-fizz"],
      image: imageUrl(env, "guava-chilli-fizz"),
    },
    {
      _id: "berry-rainbow-duo",
      type: "curated",
      name: "Berry Rainbow Duo",
      description: "Berry Blast + Rainbow Fizz together.",
      itemIds: ["berry-blast", "rainbow-fizz"],
      image: imageUrl(env, "berry-blast"),
    },
    {
      _id: "alchemy-choose-your-own-2",
      type: "choose-n",
      name: "Build Your Own Duo",
      description: "Pick any 2 mocktails from the full menu — priced at 15% off their combined price.",
      chooseCount: 2,
      eligibleItemIds: allItemIds,
    },
  ];
}

/** The one combo not owned by any single brand — eligible items span every live brand's menu. */
function buildCrossBrandCombos(allItemIds: string[]) {
  return [
    {
      _id: "mix-and-match-duo",
      type: "choose-n",
      name: "Mix & Match Duo",
      description: "Pick any 2 items from across every Lickyeat brand — a shake with a mocktail, whatever you like — at 15% off their combined price.",
      chooseCount: 2,
      eligibleItemIds: allItemIds,
    },
  ];
}

/** GG Tiffin's starter plan catalog — three styles (single meal a day, the customer's choice of
 * breakfast/lunch/dinner; twice-daily, lunch and dinner; thrice-daily, all three) × two diets ×
 * two durations. Placeholder prices, fully editable afterward via the admin Tiffin Plans page
 * (never hardcoded anywhere else in the application). */
function buildTiffinPlans(env: ReturnType<typeof loadEnv>) {
  const plans = [
    // Single — one meal a day, breakfast/lunch/dinner chosen at subscribe time.
    { name: "Weekly Veg Plan", dietType: "veg" as const, style: "single" as const, durationDays: TIFFIN_PLAN_DURATIONS.weekly, price: 899, active: true },
    { name: "Weekly Non-Veg Plan", dietType: "non-veg" as const, style: "single" as const, durationDays: TIFFIN_PLAN_DURATIONS.weekly, price: 1399, active: true },
    { name: "Monthly Veg Plan", dietType: "veg" as const, style: "single" as const, durationDays: TIFFIN_PLAN_DURATIONS.monthly, price: 3499, active: true },
    { name: "Monthly Non-Veg Plan", dietType: "non-veg" as const, style: "single" as const, durationDays: TIFFIN_PLAN_DURATIONS.monthly, price: 5499, active: true },
    // Twice-daily — both lunch and dinner, every day.
    { name: "Weekly Veg Plan — Twice Daily", dietType: "veg" as const, style: "twice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.weekly, price: 1699, active: true },
    { name: "Weekly Non-Veg Plan — Twice Daily", dietType: "non-veg" as const, style: "twice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.weekly, price: 2599, active: true },
    { name: "Monthly Veg Plan — Twice Daily", dietType: "veg" as const, style: "twice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.monthly, price: 6499, active: true },
    { name: "Monthly Non-Veg Plan — Twice Daily", dietType: "non-veg" as const, style: "twice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.monthly, price: 9999, active: true },
    // Thrice-daily — breakfast, lunch, and dinner, every day.
    { name: "Weekly Veg Plan — Thrice Daily", dietType: "veg" as const, style: "thrice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.weekly, price: 2399, active: true },
    { name: "Weekly Non-Veg Plan — Thrice Daily", dietType: "non-veg" as const, style: "thrice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.weekly, price: 3599, active: true },
    { name: "Monthly Veg Plan — Thrice Daily", dietType: "veg" as const, style: "thrice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.monthly, price: 8999, active: true },
    { name: "Monthly Non-Veg Plan — Thrice Daily", dietType: "non-veg" as const, style: "thrice-daily" as const, durationDays: TIFFIN_PLAN_DURATIONS.monthly, price: 13999, active: true },
  ];
  // Same shared veg/non-veg tiffin photo across every plan of that diet — there's no per-plan
  // dish to photograph, unlike a MenuItem.
  return plans.map((plan) => ({ ...plan, imageUrl: tiffinImageUrl(env, plan.dietType === "veg" ? "veg-tiffin" : "non-veg-tiffin") }));
}

/** One-off single-meal purchase prices, per (tier, mealType) — Mini deliberately has no
 * breakfast row (see singleMealMenu.ts), so it's simply not offered. */
function buildTiffinMealPrices() {
  return [
    { tier: "regular" as const, mealType: "breakfast" as const, price: 79, active: true },
    { tier: "regular" as const, mealType: "lunch" as const, price: 129, active: true },
    { tier: "regular" as const, mealType: "dinner" as const, price: 129, active: true },
    { tier: "mini" as const, mealType: "lunch" as const, price: 99, active: true },
    { tier: "mini" as const, mealType: "dinner" as const, price: 99, active: true },
    { tier: "premium" as const, mealType: "breakfast" as const, price: 99, active: true },
    { tier: "premium" as const, mealType: "lunch" as const, price: 169, active: true },
    { tier: "premium" as const, mealType: "dinner" as const, price: 169, active: true },
  ];
}

async function seed() {
  const env = loadEnv();
  await connectToDatabase(env.MONGODB_URI);

  await BrandModel.deleteMany({});
  await MenuItemModel.deleteMany({});
  await ComboModel.deleteMany({});
  await TiffinSubscriptionModel.deleteMany({});
  await TiffinScheduledMealModel.deleteMany({});
  await TiffinPlanModel.deleteMany({});
  await TiffinSingleMealOrderModel.deleteMany({});
  await TiffinMealPriceModel.deleteMany({});

  const brands = buildBrands(env);
  for (const brand of brands) {
    await BrandModel.findByIdAndUpdate(brand._id, brand, { upsert: true });
  }

  const tbcMenuItems = buildTbcMenuItems(env).map((item) => ({ ...item, brandId: TBC_BRAND_ID }));
  const tbcCombos = buildTbcCombos(env, tbcMenuItems.map((item) => item._id)).map((combo) => ({
    ...combo,
    brandId: TBC_BRAND_ID,
  }));

  const alchemyMenuItems = buildAlchemyTailsMenuItems(env).map((item) => ({ ...item, brandId: ALCHEMY_TAILS_BRAND_ID }));
  const alchemyCombos = buildAlchemyTailsCombos(env, alchemyMenuItems.map((item) => item._id)).map((combo) => ({
    ...combo,
    brandId: ALCHEMY_TAILS_BRAND_ID,
  }));

  // GG Tiffin is a subscription plan service, not a MenuItem-based menu — it deliberately has
  // no MenuItem rows at all (see modules/tiffin instead) and stays "coming soon" on the
  // shake-style menu screen, which is correct: it never shows GG Tiffin's real experience.
  const menuItems = [...tbcMenuItems, ...alchemyMenuItems];

  const crossBrandCombos = buildCrossBrandCombos(menuItems.map((item) => item._id)).map((combo) => ({
    ...combo,
    brandId: CROSS_BRAND_ID,
  }));

  const combos = [...tbcCombos, ...alchemyCombos, ...crossBrandCombos];

  for (const item of menuItems) {
    await MenuItemModel.findByIdAndUpdate(item._id, item, { upsert: true });
  }
  for (const combo of combos) {
    await ComboModel.findByIdAndUpdate(combo._id, combo, { upsert: true });
  }

  const tiffinPlans = await TiffinPlanModel.insertMany(buildTiffinPlans(env));
  const tiffinMealPrices = await TiffinMealPriceModel.insertMany(buildTiffinMealPrices());

  console.log(
    `Seeded ${brands.length} brands, ${menuItems.length} menu items, ${combos.length} combos, ${tiffinPlans.length} tiffin plans, and ${tiffinMealPrices.length} single-meal prices.`
  );
  await disconnectFromDatabase();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
