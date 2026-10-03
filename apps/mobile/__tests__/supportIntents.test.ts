import { describe, expect, it } from "vitest";
import { matchIntent, matchProblemTopic } from "../src/support/intents";

describe("support assistant — typed message understanding", () => {
  it.each([
    ["where is my order??", "track"],
    ["order is late", "track"],
    ["mera order kab aayega", "track"],
    ["money deducted but order not placed", "payment"],
    ["I paid via UPI and nothing happened", "payment"],
    ["I want to cancel", "cancel"],
    ["my fries are missing", "problem"],
    ["shake spilled all over", "problem"],
    ["got the wrong biryani", "problem"],
    ["when will I get my refund", "refund"],
    ["are you open now", "hours"],
    ["any coupon codes?", "offers"],
    ["do you deliver to my pincode", "delivery"],
    ["food for a party of 10", "feast"],
    ["I want to talk to a person", "human"],
    ["hello", "greeting"],
    ["thanks!", "thanks"],
  ])("%s → %s", (text, intent) => {
    expect(matchIntent(text)).toBe(intent);
  });

  it("returns null for gibberish and doesn't match short words inside other words", () => {
    expect(matchIntent("asdfgh")).toBeNull();
    expect(matchIntent("")).toBeNull();
    expect(matchIntent("cooked")).toBeNull();
  });
});

describe("support assistant — which problem a message describes", () => {
  it.each([
    ["my shake spilled", "spilled-or-damaged"],
    ["cold coffee leaked in the bag", "spilled-or-damaged"],
    ["fries missing", "missing-item"],
    ["got the wrong biryani", "wrong-item"],
    ["food was cold and stale", "quality-issue"],
    ["order is very late", "late-delivery"],
    ["something is off", null],
  ])("%s → %s", (text, topic) => {
    expect(matchProblemTopic(text)).toBe(topic);
  });
});
