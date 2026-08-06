import "dotenv/config";
import { loadEnv } from "../config/env.js";
import { connectToDatabase, disconnectFromDatabase } from "./connection.js";
import { MenuItemModel } from "./models/MenuItem.model.js";
import { ComboModel } from "./models/Combo.model.js";

/**
 * DEV-ONLY placeholder seed data — NOT the real menu. Photos are Unsplash stock
 * URLs and copy is illustrative, standing in until the actual current menu
 * (real items, real photography, real prices) is supplied. Do not treat this as
 * production content; see project spec §8.
 */
const PLACEHOLDER_MENU_ITEMS = [
  {
    _id: "choco-crush",
    signatureName: "Choco Crush",
    commonName: "Rich Chocolate Shake",
    description: "[PLACEHOLDER] A rich, indulgent chocolate shake.",
    price: 220,
    category: "signature-shakes",
    image: "https://images.unsplash.com/photo-1541658016709-82535e94bc69",
    flavorBadges: ["Chocolate Lover"],
    isPopular: true,
    isStaffPick: true,
    pairsWith: ["oreo-blast"],
  },
  {
    _id: "oreo-blast",
    signatureName: "Oreo Blast",
    commonName: "Cookies & Cream Shake",
    description: "[PLACEHOLDER] A creamy cookies-and-cream shake.",
    price: 240,
    category: "signature-shakes",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699",
    flavorBadges: ["Chocolate Lover"],
    pairsWith: ["choco-crush"],
  },
  {
    _id: "mango-tango",
    signatureName: "Mango Tango",
    commonName: "Mango Shake",
    description: "[PLACEHOLDER] A fresh, fruity mango shake.",
    price: 200,
    category: "signature-shakes",
    image: "https://images.unsplash.com/photo-1546173159-315724a31696",
    flavorBadges: ["Fruity"],
    isNew: true,
    pairsWith: ["oreo-blast"],
    // One of only a few items on sale — not the whole menu.
    salePercent: 30,
  },
  {
    _id: "strawberry-swirl",
    signatureName: "Strawberry Swirl",
    commonName: "Strawberry Shake",
    description: "[PLACEHOLDER] A sweet, swirled strawberry shake.",
    price: 210,
    category: "signature-shakes",
    image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888",
    flavorBadges: ["Fruity"],
    pairsWith: ["mango-tango"],
  },
  {
    _id: "banana-nutty",
    signatureName: "Banana Nutty",
    commonName: "Banana Nut Shake",
    description: "[PLACEHOLDER] A creamy banana shake with a nutty finish.",
    price: 230,
    category: "signature-shakes",
    image: "https://images.unsplash.com/photo-1615478503562-ec2d8aa0e24e",
    flavorBadges: ["Nutty"],
    pairsWith: ["caramel-crunch"],
  },
  {
    _id: "caramel-crunch",
    signatureName: "Caramel Crunch",
    commonName: "Caramel Shake",
    description: "[PLACEHOLDER] A rich caramel shake with a crunchy topping.",
    price: 225,
    category: "signature-shakes",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699",
    flavorBadges: ["Nutty", "Classic"],
    pairsWith: ["banana-nutty"],
  },
  {
    _id: "cold-brew-classic",
    signatureName: "Cold Brew Classic",
    commonName: "Classic Cold Coffee",
    description: "[PLACEHOLDER] A classic, smooth cold coffee.",
    price: 180,
    category: "cold-coffee",
    image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735",
    flavorBadges: ["Coffee Favorite", "Classic"],
    isPopular: true,
  },
  {
    _id: "mocha-frost",
    signatureName: "Mocha Frost",
    commonName: "Mocha Cold Coffee",
    description: "[PLACEHOLDER] A frosty mocha cold coffee.",
    price: 210,
    category: "cold-coffee",
    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c",
    flavorBadges: ["Coffee Favorite", "Chocolate Lover"],
    // One of only a few items on sale — not the whole menu.
    salePercent: 30,
  },
];

const SHAKE_IDS = PLACEHOLDER_MENU_ITEMS.filter((item) => item.category === "signature-shakes").map(
  (item) => item._id
);

/** All curated combos are exactly two shakes — price is always computed live as 15% off the pair's base prices, never stored here. */
const PLACEHOLDER_COMBOS = [
  {
    _id: "chocolate-duo",
    type: "curated",
    name: "[PLACEHOLDER] Chocolate Duo",
    description: "Choco Crush + Oreo Blast together.",
    itemIds: ["choco-crush", "oreo-blast"],
  },
  {
    _id: "tropical-twin",
    type: "curated",
    name: "[PLACEHOLDER] Tropical Twin",
    description: "Mango Tango + Strawberry Swirl together.",
    itemIds: ["mango-tango", "strawberry-swirl"],
  },
  {
    _id: "nutty-delight",
    type: "curated",
    name: "[PLACEHOLDER] Nutty Delight",
    description: "Banana Nutty + Caramel Crunch together.",
    itemIds: ["banana-nutty", "caramel-crunch"],
  },
  {
    _id: "classic-combo",
    type: "curated",
    name: "[PLACEHOLDER] Classic Combo",
    description: "Choco Crush + Caramel Crunch together.",
    itemIds: ["choco-crush", "caramel-crunch"],
  },
  {
    _id: "fruity-fusion",
    type: "curated",
    name: "[PLACEHOLDER] Fruity Fusion",
    description: "Mango Tango + Oreo Blast together.",
    itemIds: ["mango-tango", "oreo-blast"],
  },
  {
    _id: "choose-your-own-2",
    type: "choose-n",
    name: "[PLACEHOLDER] Choose Your Own Duo",
    description: "Pick any 2 signature shakes — priced at 15% off their combined price.",
    chooseCount: 2,
    eligibleItemIds: SHAKE_IDS,
  },
];

async function seed() {
  const env = loadEnv();
  await connectToDatabase(env.MONGODB_URI);

  await MenuItemModel.deleteMany({});
  await ComboModel.deleteMany({});

  for (const item of PLACEHOLDER_MENU_ITEMS) {
    await MenuItemModel.findByIdAndUpdate(item._id, item, { upsert: true });
  }
  for (const combo of PLACEHOLDER_COMBOS) {
    await ComboModel.findByIdAndUpdate(combo._id, combo, { upsert: true });
  }

  console.log(`Seeded ${PLACEHOLDER_MENU_ITEMS.length} placeholder menu items and ${PLACEHOLDER_COMBOS.length} combos.`);
  await disconnectFromDatabase();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
