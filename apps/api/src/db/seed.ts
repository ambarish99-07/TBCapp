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
];

const PLACEHOLDER_COMBOS = [
  {
    _id: "chocolate-duo",
    type: "curated",
    name: "[PLACEHOLDER] Chocolate Duo",
    description: "Choco Crush + Oreo Blast together.",
    price: 420,
    itemIds: ["choco-crush", "oreo-blast"],
  },
  {
    _id: "choose-2-for-379",
    type: "choose-n",
    name: "[PLACEHOLDER] Pick Any 2 for ₹379",
    description: "Choose any 2 eligible shakes for a flat bundle price.",
    price: 379,
    chooseCount: 2,
    eligibleItemIds: ["choco-crush", "oreo-blast", "mango-tango", "cold-brew-classic"],
  },
];

async function seed() {
  const env = loadEnv();
  await connectToDatabase(env.MONGODB_URI);

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
