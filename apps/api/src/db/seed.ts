import "dotenv/config";
import { loadEnv } from "../config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "./connection.js";
import { BrandModel } from "./models/Brand.model.js";
import { MenuItemModel } from "./models/MenuItem.model.js";
import { ComboModel } from "./models/Combo.model.js";

const TBC_BRAND_ID = "tbc";

/** Real menu photography, served by this API at /menu-images/<slug>.png (see app.ts). */
function imageUrl(env: ReturnType<typeof loadEnv>, slug: string): string {
  return `http://localhost:${env.PORT}/menu-images/${slug}.png`;
}

/** Brand logo artwork, served at /brand-images/<slug>.png (see app.ts). */
function brandLogoUrl(env: ReturnType<typeof loadEnv>, slug: string): string {
  return `http://localhost:${env.PORT}/brand-images/${slug}.png`;
}

function buildBrands(env: ReturnType<typeof loadEnv>) {
  return [
    {
      _id: TBC_BRAND_ID,
      name: "The Blenders Club",
      tagline: "Shakes, good vibes, great times.",
      status: "live" as const,
      logoUrl: brandLogoUrl(env, "tbc"),
      primaryColor: "#6B3F2A",
      accentColor: "#D98E4A",
    },
    {
      _id: "alchemy-tails",
      name: "The Alchemy Tails",
      tagline: "Crafted Mixes. Magical Experiences.",
      status: "live" as const,
      logoUrl: brandLogoUrl(env, "alchemy-tails"),
      primaryColor: "#8A6D1F",
      accentColor: "#C9A227",
    },
    {
      _id: "gg-tiffin",
      name: "GG Tiffin Service",
      tagline: "Ghar jaise swad, roz ki yaad.",
      status: "live" as const,
      logoUrl: brandLogoUrl(env, "gg-tiffin"),
      primaryColor: "#7A5A22",
      accentColor: "#B8860B",
    },
  ];
}

function buildMenuItems(env: ReturnType<typeof loadEnv>) {
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
function buildCombos(env: ReturnType<typeof loadEnv>, allItemIds: string[]) {
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

async function seed() {
  const env = loadEnv();
  await connectToDatabase(env.MONGODB_URI);

  await BrandModel.deleteMany({});
  await MenuItemModel.deleteMany({});
  await ComboModel.deleteMany({});

  const brands = buildBrands(env);
  for (const brand of brands) {
    await BrandModel.findByIdAndUpdate(brand._id, brand, { upsert: true });
  }

  const menuItems = buildMenuItems(env).map((item) => ({ ...item, brandId: TBC_BRAND_ID }));
  const combos = buildCombos(env, menuItems.map((item) => item._id)).map((combo) => ({
    ...combo,
    brandId: TBC_BRAND_ID,
  }));

  for (const item of menuItems) {
    await MenuItemModel.findByIdAndUpdate(item._id, item, { upsert: true });
  }
  for (const combo of combos) {
    await ComboModel.findByIdAndUpdate(combo._id, combo, { upsert: true });
  }

  console.log(`Seeded ${brands.length} brands, ${menuItems.length} menu items, and ${combos.length} combos.`);
  await disconnectFromDatabase();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
