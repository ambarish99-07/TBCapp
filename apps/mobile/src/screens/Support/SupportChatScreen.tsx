import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT,
  SUPPORT_TOPIC_LABELS,
  type Coupon,
  type Order,
  type OrderStatus,
  type SupportTopic,
} from "@tbc/shared-types";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAllActiveCoupons } from "../../api/coupons.api";
import { cancelOrderRequest, fetchMyOrders, fetchOrderByAccessToken } from "../../api/orders.api";
import { useKitchensOpen } from "../../api/storeStatus.api";
import { createSupportTicket, fetchMySupportTickets, uploadSupportPhoto } from "../../api/support.api";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP_NUMBER } from "../../constants/support";
import { theme, type ColorPalette } from "../../constants/theme";
import type { RootStackParamList } from "../../navigation/types";
import { useAuthStore } from "../../state/authStore";
import { useTheme } from "../../state/themeStore";
import { matchIntent, matchProblemTopic, type SupportIntent } from "../../support/intents";

type Props = NativeStackScreenProps<RootStackParamList, "SupportChat">;

interface ChatOption {
  label: string;
  onPress: () => void;
}

interface ChatMessage {
  id: string;
  from: "bot" | "user";
  text: string;
  imageUri?: string;
}

/** What a typed reply means right now — free text normally goes through intent matching, but
 * while the assistant is collecting details for a help request it's the description itself. */
type Awaiting = { kind: "details"; topic: SupportTopic; order?: Order } | null;

const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Order received",
  preparing: "Being prepared",
  "out-for-delivery": "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const ACTIVE_STATUSES: OrderStatus[] = ["received", "preparing", "out-for-delivery"];
const PROBLEM_TOPICS: SupportTopic[] = ["missing-item", "wrong-item", "spilled-or-damaged", "quality-issue", "late-delivery", "other"];

function orderLabel(order: Order): string {
  const items = order.items.reduce((n, line) => n + line.quantity, 0);
  return `#${order.orderNumber.slice(-9)} · ${items} item${items === 1 ? "" : "s"} · ₹${order.totals.total}`;
}

function couponLine(c: Coupon): string {
  const what = c.type === "percent" ? `${c.value}% off${c.maxDiscountAmount ? ` (up to ₹${c.maxDiscountAmount})` : ""}` : c.type === "bogo" ? "Buy 1 Get 1 free" : `₹${c.value} off`;
  return `${c.code} — ${what}${c.minOrderAmount > 0 ? ` on orders above ₹${c.minOrderAmount}` : ""}${c.oncePerCustomer ? " · one use" : ""}`;
}

// Unique per message even across a code reload (a plain module-level counter restarts at 0 then
// and collides with messages already on screen).
let nextId = 0;
const newId = () => `m${Date.now().toString(36)}-${++nextId}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * The in-app support assistant ("Lickyeat Assistant") — a guided chat, not an AI model. It solves
 * the common small problems itself using the customer's real orders (track, cancel by policy,
 * refund status, kitchen hours, offers, delivery info) and turns the rest — a missing/wrong/
 * spilled item, a payment that didn't confirm — into a help request (with an optional photo)
 * that lands in the admin's "Help Requests" inbox. "Talk to a person" is always one tap away.
 */
export function SupportChatScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore((state) => state.user);
  const kitchens = useKitchensOpen();
  const { data: coupons } = useAllActiveCoupons();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [options, setOptions] = useState<ChatOption[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [awaiting, setAwaiting] = useState<Awaiting>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Latest values for async flows without re-creating every handler.
  const kitchensRef = useRef(kitchens);
  kitchensRef.current = kitchens;
  const couponsRef = useRef(coupons);
  couponsRef.current = coupons;

  const say = useCallback(async (text: string, nextOptions: ChatOption[] = []) => {
    setOptions([]);
    setTyping(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    setTyping(false);
    setMessages((current) => [...current, { id: newId(), from: "bot", text }]);
    setOptions(nextOptions);
  }, []);

  const userSays = useCallback((text: string, imageUri?: string) => {
    setOptions([]);
    setMessages((current) => [...current, { id: newId(), from: "user", text, imageUri }]);
  }, []);

  /** Wraps a choice so tapping it echoes the label as the customer's message first. */
  const choice = useCallback(
    (label: string, run: () => void | Promise<void>): ChatOption => ({
      label,
      onPress: () => {
        userSays(label);
        void run();
      },
    }),
    [userSays]
  );

  // --- flows ------------------------------------------------------------------------------

  const menuOptions = useCallback((): ChatOption[] => {
    return [
      choice("📦 Where's my order?", () => flows.current.track()),
      choice("❌ Cancel an order", () => flows.current.cancel()),
      choice("🍔 Problem with my order", () => flows.current.problem()),
      choice("💳 Paid, but order not confirmed", () => flows.current.payment()),
      choice("💰 Refund status", () => flows.current.refunds()),
      choice("🕒 Are you open now?", () => flows.current.hours()),
      choice("🏷️ Offers & coupons", () => flows.current.offers()),
      choice("🛵 Delivery area & charges", () => flows.current.delivery()),
      choice("🍽️ What is a Feast?", () => flows.current.feast()),
      choice("📨 My help requests", () => flows.current.myRequests()),
      choice("🙋 Talk to a person", () => flows.current.human()),
    ];
  }, [choice]);

  const backToMenu = useCallback(
    (): ChatOption[] => [choice("Something else", () => flows.current.menu("What else can I help with?")), choice("🙋 Talk to a person", () => flows.current.human())],
    [choice]
  );

  const flows = useRef({
    menu: async (_intro?: string) => {},
    track: async () => {},
    cancel: async () => {},
    problem: async (_hint?: SupportTopic | null) => {},
    payment: async () => {},
    refunds: async () => {},
    hours: async () => {},
    offers: async () => {},
    delivery: async () => {},
    feast: async () => {},
    myRequests: async () => {},
    human: async () => {},
    route: async (_intent: SupportIntent, _text?: string) => {},
  });

  /** Order flows need an account — guests are pointed to log in or look up by order id. */
  const requireLogin = useCallback(async (): Promise<boolean> => {
    if (user) return true;
    await say("To look at your orders, please log in first.", [
      { label: "Log in", onPress: () => navigation.navigate("Login") },
      { label: "Track a guest order", onPress: () => navigation.navigate("GuestLookup") },
      ...backToMenu(),
    ]);
    return false;
  }, [user, say, navigation, backToMenu]);

  const loadOrders = useCallback(async (): Promise<Order[] | null> => {
    try {
      return await fetchMyOrders();
    } catch {
      await say("I couldn't load your orders just now — please check your internet and try again.", backToMenu());
      return null;
    }
  }, [say, backToMenu]);

  const submitTicket = useCallback(
    async (topic: SupportTopic, message: string, order?: Order, photoUri?: { uri: string; mimeType?: string | null; fileName?: string | null }) => {
      setTyping(true);
      try {
        const photoUrl = photoUri ? await uploadSupportPhoto(photoUri) : undefined;
        const ticket = await createSupportTicket({ topic, message, orderId: order?.id, photoUrl });
        setTyping(false);
        await say(
          `Done — I've raised help request ${ticket.ticketNumber} (${SUPPORT_TOPIC_LABELS[topic]}${order ? ` for order #${order.orderNumber.slice(-9)}` : ""}). ` +
            `Our team will look into it and reply right here under "My help requests"${user?.phone ? `, or call you on ${user.phone}` : ""}. ` +
            "If it's urgent, WhatsApp us.",
          [choice("📨 My help requests", () => flows.current.myRequests()), choice("💬 WhatsApp us", () => flows.current.human()), ...backToMenu().slice(0, 1)]
        );
      } catch (err) {
        setTyping(false);
        await say(`Sorry, I couldn't send that: ${err instanceof Error ? err.message : "please try again"}.`, [
          choice("Try again", () => submitTicket(topic, message, order, photoUri)),
          choice("🙋 Talk to a person", () => flows.current.human()),
        ]);
      }
    },
    [say, choice, backToMenu, user]
  );

  /** After the description: offer to attach a photo (useful for spilled/wrong items), then send. */
  const askForPhoto = useCallback(
    async (topic: SupportTopic, message: string, order?: Order) => {
      const pick = async (fromCamera: boolean) => {
        const permission = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          await say("I need permission to use photos for that. You can still send it without one.", [
            choice("Send without a photo", () => submitTicket(topic, message, order)),
          ]);
          return;
        }
        const result = fromCamera
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
        if (result.canceled || !result.assets[0]) {
          await say("No photo added.", [
            choice("📷 Take a photo", () => pick(true)),
            choice("🖼️ Choose from gallery", () => pick(false)),
            choice("Send without a photo", () => submitTicket(topic, message, order)),
          ]);
          return;
        }
        const asset = result.assets[0];
        userSays("Photo attached", asset.uri);
        await submitTicket(topic, message, order, { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
      };
      await say("Got it. A photo helps us sort it out faster — want to add one?", [
        { label: "📷 Take a photo", onPress: () => void pick(true) },
        { label: "🖼️ Choose from gallery", onPress: () => void pick(false) },
        choice("Send without a photo", () => submitTicket(topic, message, order)),
      ]);
    },
    [say, choice, submitTicket, userSays]
  );

  const askForDetails = useCallback(
    async (topic: SupportTopic, order?: Order) => {
      setAwaiting({ kind: "details", topic, order });
      const prompt =
        topic === "payment-not-confirmed"
          ? "Please type the amount and, if you have it, the UPI / transaction reference shown in your bank or UPI app."
          : topic === "missing-item"
            ? "Which item(s) were missing? Type them below."
            : topic === "wrong-item"
              ? "What did you get, and what had you ordered? Type it below."
              : "Tell me what happened in a line or two — type it below.";
      await say(prompt);
    },
    [say]
  );

  flows.current.menu = async (intro = "How can I help you today?") => {
    setAwaiting(null);
    await say(intro, menuOptions());
  };

  flows.current.track = async () => {
    if (!(await requireLogin())) return;
    const orders = await loadOrders();
    if (!orders) return;
    const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    if (active.length === 0) {
      await say("You don't have any order on the way right now. Your past orders are in Order History.", [
        { label: "Open Order History", onPress: () => navigation.navigate("OrderHistory") },
        ...backToMenu(),
      ]);
      return;
    }
    for (const order of active) {
      const due = new Date(order.createdAt).getTime() + order.estimatedMinutes * 60_000;
      const minutesLeft = Math.round((due - Date.now()) / 60_000);
      const timing =
        minutesLeft > 0 ? `It should reach you in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.` : "It's running a little later than we estimated — sorry about that, it's on priority.";
      const rider = order.deliveryPartner ? ` Your rider is ${order.deliveryPartner.name}.` : "";
      await say(`${orderLabel(order)}\nStatus: ${STATUS_LABEL[order.status]}. ${timing}${rider}`, [
        { label: "Open live tracking", onPress: () => navigation.navigate("OrderStatus", { accessToken: order.accessToken }) },
        ...(order.deliveryPartner ? [{ label: "📞 Call the rider", onPress: () => void Linking.openURL(`tel:${order.deliveryPartner!.phone}`) }] : []),
        ...(minutesLeft <= 0 ? [choice("Report late delivery", () => askForDetails("late-delivery", order))] : []),
        ...backToMenu(),
      ]);
    }
  };

  flows.current.cancel = async () => {
    if (!(await requireLogin())) return;
    const orders = await loadOrders();
    if (!orders) return;
    const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    if (active.length === 0) {
      await say("There's no order in progress to cancel. If something went wrong with a delivered order, I can raise it for you.", [
        choice("🍔 Problem with my order", () => flows.current.problem()),
        ...backToMenu(),
      ]);
      return;
    }
    const confirmCancel = async (order: Order) => {
      const paidOnline = order.payment.method === "razorpay" && order.payment.status === "paid";
      const refund =
        order.status === "received"
          ? order.totals.total
          : Math.round(order.totals.total * ORDER_CANCELLATION_DISPATCHED_REFUND_PERCENT);
      const policy = !paidOnline
        ? "This is a Cash on Delivery order, so nothing has been charged — cancelling costs you nothing."
        : order.status === "received"
          ? `The kitchen hasn't started yet, so you'd get a full refund of ₹${refund}.`
          : `It's already ${order.status === "preparing" ? "being prepared" : "on the way"}, so cancelling now refunds 50% (₹${refund}).`;
      await say(`${orderLabel(order)}\n${policy}\nCancel this order?`, [
        choice("Yes, cancel it", async () => {
          setTyping(true);
          try {
            const updated = await cancelOrderRequest(order.accessToken, "Cancelled from the help chat");
            setTyping(false);
            const refundAmount = updated.payment.refundAmount ?? 0;
            await say(
              refundAmount > 0
                ? `Your order is cancelled. A refund of ₹${refundAmount} is approved and goes back to your original payment method — you can check it any time under "Refund status".`
                : "Your order is cancelled. Nothing was charged.",
              backToMenu()
            );
          } catch (err) {
            setTyping(false);
            await say(`I couldn't cancel it: ${err instanceof Error ? err.message : "please try again"}.`, backToMenu());
          }
        }),
        choice("No, keep it", () => flows.current.menu("No problem — your order stays as it is. Anything else?")),
      ]);
    };
    if (active.length === 1) {
      await confirmCancel(active[0]);
      return;
    }
    await say("Which order do you want to cancel?", active.map((o) => choice(orderLabel(o), () => confirmCancel(o))));
  };

  // `hint` = the problem the customer already described in their own words ("my shake
  // spilled"), so they aren't asked again.
  flows.current.problem = async (hint) => {
    if (!(await requireLogin())) return;
    const orders = await loadOrders();
    if (!orders) return;
    const recent = orders.filter((o) => o.status !== "cancelled").slice(0, 5);
    const pickTopic = async (order?: Order) => {
      if (hint) {
        await askForDetails(hint, order);
        return;
      }
      await say(
        order ? `What went wrong with ${orderLabel(order)}?` : "What's the problem?",
        PROBLEM_TOPICS.map((topic) => choice(SUPPORT_TOPIC_LABELS[topic], () => askForDetails(topic, order)))
      );
    };
    if (recent.length === 0) {
      await pickTopic();
      return;
    }
    await say("Which order is this about?", [
      ...recent.map((o) => choice(`${orderLabel(o)} · ${STATUS_LABEL[o.status]}`, () => pickTopic(o))),
      choice("It's not one of these", () => pickTopic()),
    ]);
  };

  flows.current.payment = async () => {
    if (!(await requireLogin())) return;
    const orders = await loadOrders();
    if (!orders) return;
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const unconfirmed = orders.filter(
      (o) => o.payment.method === "razorpay" && o.payment.status !== "paid" && o.payment.status !== "refunded" && new Date(o.createdAt).getTime() > twoDaysAgo
    );
    const intro =
      "Sorry about that — if money left your account but the order didn't confirm, our team will check the payment with our payment provider and either confirm your order or refund you.";
    if (unconfirmed.length === 0) {
      await say(`${intro} Let's raise it now.`);
      await askForDetails("payment-not-confirmed");
      return;
    }
    await say(`${intro} Is it one of these?`, [
      ...unconfirmed.map((o) => choice(orderLabel(o), () => askForDetails("payment-not-confirmed", o))),
      choice("It's not listed", () => askForDetails("payment-not-confirmed")),
    ]);
  };

  flows.current.refunds = async () => {
    if (!(await requireLogin())) return;
    const orders = await loadOrders();
    if (!orders) return;
    const refunds = orders.filter((o) => (o.payment.refundAmount ?? 0) > 0);
    if (refunds.length === 0) {
      await say("You don't have any refunds on record. If you were charged for an order that didn't go through, tell me and I'll raise it.", [
        choice("💳 Paid, but order not confirmed", () => flows.current.payment()),
        ...backToMenu(),
      ]);
      return;
    }
    const lines = refunds
      .slice(0, 5)
      .map((o) => `• ${orderLabel(o)} — ₹${o.payment.refundAmount} refund approved${o.cancellationReason ? ` (${o.cancellationReason})` : ""}`)
      .join("\n");
    await say(
      `${lines}\n\nApproved refunds go back to your original payment method. If one hasn't reached you, I can raise it with our team.`,
      [choice("Refund hasn't arrived", () => askForDetails("other", refunds[0])), ...backToMenu()]
    );
  };

  flows.current.hours = async () => {
    const list = kitchensRef.current;
    if (list.length === 0) {
      await say("I couldn't load the kitchens just now — please try again in a moment.", backToMenu());
      return;
    }
    const lines = list.map(({ brand, isOpen }) => `${isOpen ? "🟢" : "🔴"} ${brand.name} — ${isOpen ? "open now" : "closed right now"}`).join("\n");
    const anyOpen = list.some((k) => k.isOpen);
    await say(
      `${lines}\n\n${anyOpen ? "You can mix items from every open kitchen in one order." : "All our kitchens are closed right now — the home screen shows when they reopen."}`,
      [
        ...(anyOpen ? [{ label: "Start ordering", onPress: () => navigation.navigate("Menu") }] : []),
        { label: "🍽️ Open Feast", onPress: () => navigation.navigate("Feast") },
        ...backToMenu(),
      ]
    );
  };

  flows.current.offers = async () => {
    const list = couponsRef.current ?? [];
    if (list.length === 0) {
      await say("There are no coupons running right now — Feast combos and Premium membership are the best ways to save.", [
        { label: "🍽️ Open Feast", onPress: () => navigation.navigate("Feast") },
        ...backToMenu(),
      ]);
      return;
    }
    await say(
      `Here's what's on right now:\n${list.slice(0, 8).map((c) => `• ${couponLine(c)}`).join("\n")}\n\nApply a code from your cart → "Apply Coupon".`,
      [{ label: "See all coupons", onPress: () => navigation.navigate("AllCoupons") }, ...backToMenu()]
    );
  };

  flows.current.delivery = async () => {
    await say(
      "We deliver across Patna, within a set distance of our kitchen — checkout tells you right away if an address is outside it, before you pay.\n\n" +
        "The delivery charge (if any) is shown in your cart before you pay. Premium members get free delivery on every order.",
      [{ label: "👑 Premium membership", onPress: () => navigation.navigate("PremiumMembership") }, ...backToMenu()]
    );
  };

  flows.current.feast = async () => {
    await say(
      "A Feast is one order from all our kitchens together — biryani, shakes, mocktails and more, one delivery, one payment. " +
        "Pick a size (For One, For Two, For Four or Party), then choose a ready-made Feast or build your own — you can even pick the same dish more than once.",
      [{ label: "🍽️ Open Feast", onPress: () => navigation.navigate("Feast") }, ...backToMenu()]
    );
  };

  flows.current.myRequests = async () => {
    if (!(await requireLogin())) return;
    try {
      const tickets = await fetchMySupportTickets();
      if (tickets.length === 0) {
        await say("You haven't raised any help requests yet.", backToMenu());
        return;
      }
      const statusText = { open: "Open", "in-progress": "In progress", resolved: "Resolved ✅" } as const;
      const lines = tickets
        .slice(0, 5)
        .map(
          (t) =>
            `• ${t.ticketNumber} · ${SUPPORT_TOPIC_LABELS[t.topic]}${t.orderNumber ? ` · #${t.orderNumber.slice(-9)}` : ""} — ${statusText[t.status]}` +
            (t.adminReply ? `\n   Our reply: ${t.adminReply}` : "")
        )
        .join("\n");
      await say(lines, backToMenu());
    } catch {
      await say("I couldn't load your help requests just now — please try again.", backToMenu());
    }
  };

  flows.current.human = async () => {
    await say("Our team is happy to help — pick how you'd like to reach us:", [
      { label: "💬 WhatsApp", onPress: () => void Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`) },
      { label: "📞 Call", onPress: () => void Linking.openURL(`tel:${SUPPORT_PHONE}`) },
      { label: "✉️ Email", onPress: () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`) },
      choice("Back to the menu", () => flows.current.menu()),
    ]);
  };

  flows.current.route = async (intent: SupportIntent, text?: string) => {
    switch (intent) {
      case "track":
        return flows.current.track();
      case "cancel":
        return flows.current.cancel();
      case "problem":
        return flows.current.problem(text ? matchProblemTopic(text) : null);
      case "payment":
        return flows.current.payment();
      case "refund":
        return flows.current.refunds();
      case "hours":
        return flows.current.hours();
      case "offers":
        return flows.current.offers();
      case "delivery":
        return flows.current.delivery();
      case "feast":
        return flows.current.feast();
      case "my-requests":
        return flows.current.myRequests();
      case "human":
        return flows.current.human();
      case "greeting":
        return flows.current.menu(`Hi${user ? ` ${user.fullName.split(" ")[0]}` : ""}! How can I help?`);
      case "thanks":
        return flows.current.menu("Happy to help! Anything else?");
    }
  };

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    userSays(text);
    if (awaiting?.kind === "details") {
      const { topic, order } = awaiting;
      setAwaiting(null);
      if (text.length < 3) {
        setAwaiting({ kind: "details", topic, order });
        await say("Could you add a little more detail?");
        return;
      }
      await askForPhoto(topic, text, order);
      return;
    }
    const intent = matchIntent(text);
    if (intent) {
      await flows.current.route(intent, text);
      return;
    }
    await say("Sorry, I didn't quite get that. Here's what I can help with — or talk to a person:", menuOptions());
  }

  // Greeting — opened from an order's screen it starts with that order's own options.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const firstName = user?.fullName?.split(" ")[0];
    void (async () => {
      const accessToken = route.params?.accessToken;
      if (accessToken) {
        try {
          const order = await fetchOrderByAccessToken(accessToken);
          const active = ACTIVE_STATUSES.includes(order.status);
          await say(`Hi${firstName ? ` ${firstName}` : ""}! I'm the Lickyeat Assistant. Need help with ${orderLabel(order)} (${STATUS_LABEL[order.status]})?`, [
            ...(active ? [choice("📦 Where is it?", () => flows.current.track()), choice("❌ Cancel it", () => flows.current.cancel())] : []),
            choice("🍔 Something's wrong with it", () =>
              say(
                "What went wrong?",
                PROBLEM_TOPICS.map((topic) => choice(SUPPORT_TOPIC_LABELS[topic], () => askForDetails(topic, order)))
              )
            ),
            ...(order.payment.method === "razorpay" && order.payment.status !== "paid"
              ? [choice("💳 Paid, but not confirmed", () => askForDetails("payment-not-confirmed", order))]
              : []),
            choice("Something else", () => flows.current.menu()),
          ]);
          return;
        } catch {
          // Fall through to the general greeting.
        }
      }
      await say(`Hi${firstName ? ` ${firstName}` : ""}! 👋 I'm the Lickyeat Assistant. Tap an option below, or type your question.`, menuOptions());
    })();
  }, [route.params, user, say, choice, askForDetails, menuOptions]);

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {/* "handled": with the keyboard open, a tap on an option chip still selects it (the default
          swallows that first tap just to close the keyboard). */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m) => (
          <View key={m.id} style={[s.bubble, m.from === "bot" ? s.botBubble : s.userBubble]}>
            {m.imageUri && <Image source={{ uri: m.imageUri }} style={s.photo} />}
            <Text style={m.from === "bot" ? s.botText : s.userText}>{m.text}</Text>
          </View>
        ))}
        {typing && (
          <View style={[s.bubble, s.botBubble, s.typing]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        {options.length > 0 && (
          <View style={s.options}>
            {options.map((o) => (
              <Pressable key={o.label} style={({ pressed }) => [s.option, pressed && s.optionPressed]} onPress={o.onPress}>
                <Text style={s.optionText}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder={awaiting ? "Describe what happened…" : "Type your question…"}
          placeholderTextColor={colors.muted}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          maxLength={1000}
          multiline={!!awaiting}
        />
        <Pressable style={[s.send, !input.trim() && s.sendDisabled]} onPress={handleSend} disabled={!input.trim()}>
          <Text style={s.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    list: { padding: theme.spacing(2), paddingBottom: theme.spacing(3), gap: theme.spacing(1) },
    bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    botBubble: { alignSelf: "flex-start", backgroundColor: colors.surface, borderTopLeftRadius: 4 },
    userBubble: { alignSelf: "flex-end", backgroundColor: colors.primary, borderTopRightRadius: 4 },
    typing: { paddingVertical: 12, paddingHorizontal: 18 },
    botText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    userText: { color: "#fff", fontSize: 14, lineHeight: 20 },
    photo: { width: 180, height: 180, borderRadius: 10, marginBottom: 6 },
    options: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: theme.spacing(0.5) },
    option: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.background,
    },
    optionPressed: { backgroundColor: colors.primary + "22" },
    optionText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      padding: theme.spacing(1.5),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      maxHeight: 110,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    send: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 },
    sendDisabled: { opacity: 0.4 },
    sendText: { color: "#fff", fontWeight: "700" },
  });
