import { FEAST_COMBO_BRAND_ID, type FeastSize } from "@tbc/shared-types";
import { ComboModel } from "./models/Combo.model.js";
import { MenuItemModel } from "./models/MenuItem.model.js";

interface FeastComboSeed {
  _id: string;
  type: "curated" | "choose-n";
  feastSize: FeastSize;
  name: string;
  description: string;
  itemIds?: string[];
  chooseCount?: number;
  eligibleItemIds?: string[];
}

/**
 * Feast combos — owned by no single kitchen (brandId FEAST_COMBO_BRAND_ID): a full meal across
 * kitchens (biryani + shake + mocktail...), ordered and paid for once. Curated ones reference real
 * item ids, some from The Biryani Lane, which is admin-added rather than seeded — so
 * syncFeastCombos only writes a curated Feast whose items all actually exist. No discountPercent
 * set: they fall back to the global combo default until the owner decides Feast pricing.
 * Every Feast has a size (For One / For Two / For Four / Party — the Feast page's tabs), and each
 * size has its own build-your-own: pick N items (repeats allowed) from any open kitchen — the empty
 * eligibleItemIds means "any item from any open kitchen".
 */
export const FEAST_COMBO_SEED_DATA: FeastComboSeed[] = [
  {
    _id: "feast-solo",
    type: "curated",
    feastSize: "one",
    name: "Solo Feast",
    description: "A full meal for one — Chicken Biryani, a Coffee Chill and a Virgin Mojito.",
    itemIds: ["chicken-biryani", "coffee-chill", "virgin-mojito"],
  },
  {
    _id: "feast-veggie",
    type: "curated",
    feastSize: "one",
    name: "Veggie Feast",
    description: "All-veg meal for one — Paneer Biryani, a Mango Magic shake and a Rose Lemonade.",
    itemIds: ["paneer-biryani", "mango-magic", "rose-lemonade"],
  },
  {
    _id: "feast-date-night",
    type: "curated",
    feastSize: "two",
    name: "Date Night Feast",
    description: "For two — Hyderabadi Chicken Biryani, Paneer Tikka Biryani, a Choco Crush shake and a Pina Colada.",
    itemIds: ["hyderabadi-biryani", "paneer-tikka-biryani", "choco-crush", "pina-colada"],
  },
  {
    _id: "feast-family",
    type: "curated",
    feastSize: "four",
    name: "Family Feast",
    description:
      "Feeds four — Shahi Chicken, Kolkata Chicken and Veg Biryani, two shakes (Caramel Bliss, Vanilla Dream) and two mocktails (Blue Lagoon, Strawberry Mojito).",
    itemIds: ["shahi-chicken-biryani", "kolkata-style-biryani", "veg-biryani", "caramel-bliss", "vanilla-dream", "blue-lagoon", "strawberry-mojito"],
  },
  {
    _id: "feast-party",
    type: "curated",
    feastSize: "party",
    name: "Party Feast",
    description: "For a small gathering — five biryanis, three shakes, two cold coffees and three mocktails, all in one order.",
    itemIds: [
      "chicken-biryani",
      "hyderabadi-biryani",
      "sarson-chicken-biryani",
      "egg-biryani",
      "paneer-biryani",
      "choco-crush",
      "cookie-crush",
      "mango-magic",
      "mocha-magic",
      "caramel-brew",
      "watermelon-mojito",
      "green-apple-fizz",
      "pineapple-punch",
    ],
  },
  {
    _id: "feast-byo-one",
    type: "choose-n",
    feastSize: "one",
    name: "Build Your Own — For One",
    description: "Pick any 3 items from any of our open kitchens — a biryani, a shake, a mocktail, or whatever you like.",
    chooseCount: 3,
    eligibleItemIds: [],
  },
  {
    _id: "feast-byo-two",
    type: "choose-n",
    feastSize: "two",
    name: "Build Your Own — For Two",
    description: "Pick any 5 items from any of our open kitchens — repeat your favourites if you like.",
    chooseCount: 5,
    eligibleItemIds: [],
  },
  {
    _id: "feast-byo-four",
    type: "choose-n",
    feastSize: "four",
    name: "Build Your Own — For Four",
    description: "Pick any 8 items from any of our open kitchens — enough for the whole family, repeats welcome.",
    chooseCount: 8,
    eligibleItemIds: [],
  },
  {
    _id: "feast-byo-party",
    type: "choose-n",
    feastSize: "party",
    name: "Build Your Own — Party",
    description: "Pick any 12 items from any of our open kitchens — biryanis, shakes, mocktails, as many of each as your crowd wants.",
    chooseCount: 12,
    eligibleItemIds: [],
  },
];

/** Feast ids that existed before and were since replaced — removed on every sync. */
const RETIRED_FEAST_COMBO_IDS = ["feast-build-your-own"];

/**
 * Removes the retired single cross-brand "Mix & Match Duo" and upserts the Feast combos — shared
 * by seed.ts and scripts/sync-feast-combos.ts (which runs just this against a live DB, without the
 * rest of seed's coupon/tiffin resets). Only the fields defined above are $set, so an admin-set
 * discountPercent or uploaded photo survives a re-run. Returns how many Feast combos were written.
 */
export async function syncFeastCombos(log: (message: string) => void = console.log): Promise<number> {
  const removed = await ComboModel.deleteMany({ brandId: "cross-brand" });
  if (removed.deletedCount) log(`Removed ${removed.deletedCount} old cross-brand combo(s).`);
  const retired = await ComboModel.deleteMany({ _id: { $in: RETIRED_FEAST_COMBO_IDS } });
  if (retired.deletedCount) log(`Removed ${retired.deletedCount} retired Feast combo(s).`);

  let written = 0;
  for (const combo of FEAST_COMBO_SEED_DATA) {
    const update: Record<string, unknown> = { ...combo, brandId: FEAST_COMBO_BRAND_ID };
    if (combo.itemIds) {
      const items = await MenuItemModel.find({ _id: { $in: combo.itemIds } }, "image").lean();
      if (items.length !== combo.itemIds.length) {
        log(`Skipping Feast combo "${combo.name}" — not every item exists in this database yet.`);
        continue;
      }
      // First item's photo as a default only — never overwrites a photo the admin uploaded.
      const existing = await ComboModel.findById(combo._id, "image").lean();
      const image = items.find((item) => item._id === combo.itemIds![0])?.image;
      if (!existing?.image && image) update.image = image;
    }
    await ComboModel.findByIdAndUpdate(combo._id, update, { upsert: true });
    written += 1;
  }
  log(`Wrote ${written} Feast combo(s).`);
  return written;
}
