/**
 * What the support assistant understands from a typed message. Deliberately simple keyword
 * matching, not an AI model: every answer the assistant gives comes from a fixed, tested flow
 * backed by real order data, so it can never invent a refund policy or promise something the
 * kitchen can't do. Anything it doesn't recognise falls back to the main menu plus "talk to a
 * person". Hindi/Hinglish words customers commonly type are included alongside English.
 */
export type SupportIntent =
  | "track"
  | "cancel"
  | "problem"
  | "payment"
  | "refund"
  | "hours"
  | "offers"
  | "delivery"
  | "feast"
  | "my-requests"
  | "human"
  | "greeting"
  | "thanks";

// Order matters: the first intent whose keywords appear wins, so more specific problems come
// before generic ones ("payment deducted but no order" is a payment issue, not tracking).
const RULES: { intent: SupportIntent; keywords: string[] }[] = [
  { intent: "human", keywords: ["human", "agent", "person", "talk to", "call me", "customer care", "executive", "baat"] },
  { intent: "payment", keywords: ["deducted", "debited", "money cut", "paisa", "paise", "payment", "paid", "upi", "transaction", "charged twice"] },
  { intent: "refund", keywords: ["refund", "money back", "return my money", "wapas"] },
  { intent: "cancel", keywords: ["cancel", "cancellation", "don't want", "dont want", "nahi chahiye"] },
  {
    intent: "problem",
    keywords: ["missing", "wrong", "spill", "leak", "damaged", "broken", "cold", "stale", "bad", "quality", "hair", "less quantity", "not received item", "galat", "kharab"],
  },
  { intent: "track", keywords: ["where", "track", "status", "late", "delay", "how long", "eta", "rider", "kab", "kahan", "not arrived", "not delivered"] },
  { intent: "hours", keywords: ["open", "close", "closed", "timing", "time", "hours", "kitchen"] },
  { intent: "offers", keywords: ["offer", "coupon", "discount", "code", "deal", "promo"] },
  { intent: "delivery", keywords: ["deliver", "area", "pincode", "location", "distance", "delivery charge", "delivery fee", "far"] },
  { intent: "feast", keywords: ["feast", "combo", "family", "party", "group"] },
  { intent: "my-requests", keywords: ["my request", "my complaint", "ticket", "complaint status"] },
  { intent: "thanks", keywords: ["thank", "thanks", "thx", "ok", "okay", "great", "dhanyavad", "shukriya"] },
  { intent: "greeting", keywords: ["hi", "hello", "hey", "namaste", "hii", "good morning", "good evening"] },
];

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ' ]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** The best-matching intent for a typed message, or null if nothing matched. */
export function matchIntent(text: string): SupportIntent | null {
  const haystack = normalise(text);
  if (haystack.trim().length === 0) return null;
  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      // Whole-word match for short keywords (so "ok" doesn't fire inside "cooked"), substring
      // for multi-word phrases.
      const needle = keyword.includes(" ") ? keyword : ` ${keyword}`;
      if (haystack.includes(needle)) return rule.intent;
    }
  }
  return null;
}

/** Within a "problem with my order" message, which kind of problem — so "my shake spilled" goes
 * straight to Spilled / damaged instead of asking. Null when the message doesn't say. */
export function matchProblemTopic(
  text: string
): "missing-item" | "wrong-item" | "spilled-or-damaged" | "quality-issue" | "late-delivery" | null {
  const haystack = normalise(text);
  const has = (words: string[]) => words.some((w) => haystack.includes(w.includes(" ") ? w : ` ${w}`));
  if (has(["spill", "leak", "damaged", "broken", "torn", "open packet"])) return "spilled-or-damaged";
  if (has(["missing", "not received item", "didn't get", "didnt get", "less quantity", "short"])) return "missing-item";
  if (has(["wrong", "galat", "different item", "not what i ordered"])) return "wrong-item";
  if (has(["cold", "stale", "bad", "quality", "hair", "kharab", "taste", "raw", "burnt"])) return "quality-issue";
  if (has(["late", "delay", "not arrived", "not delivered"])) return "late-delivery";
  return null;
}
