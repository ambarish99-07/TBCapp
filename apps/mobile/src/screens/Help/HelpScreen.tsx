import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_WHATSAPP_NUMBER } from "../../constants/support";
import { theme, type ColorPalette } from "../../constants/theme";
import { useTheme } from "../../state/themeStore";

type Styles = ReturnType<typeof makeStyles>;

/** Plain Q&A pairs, no backend — the answers describe real, current app behavior (delivery zone,
 * cancellation refund tiers, payment methods) rather than anything that needs editing per order,
 * so a static list is the right amount of machinery here. */
const FAQS: { question: string; answer: string }[] = [
  {
    question: "How do I track my order?",
    answer: "Open Order History from your profile, or use the floating order tracker that appears while an order is active — it shows live status and, once a rider is assigned, their contact details.",
  },
  {
    question: "Can I cancel an order after placing it?",
    answer:
      "Yes, from the Order Status screen. You get a full refund if you cancel before the order is dispatched, and a partial refund once it's out for delivery — the exact amount is shown before you confirm.",
  },
  {
    question: "What areas do you deliver to?",
    answer: "We currently deliver within Patna, within a limited radius of our kitchen. If your address falls outside that area, checkout will let you know before you pay.",
  },
  {
    question: "What payment methods are accepted?",
    answer: "Cash on Delivery and online payment via Razorpay (cards, UPI, netbanking, wallets) — pick either at checkout.",
  },
  {
    question: "My payment went through but the order didn't show up. What now?",
    answer: "Contact us using any option below with your payment reference — we'll check and sort it out manually.",
  },
];

function FaqRow({ item, isOpen, onToggle, s }: { item: (typeof FAQS)[number]; isOpen: boolean; onToggle: () => void; s: Styles }) {
  return (
    <Pressable style={s.faqRow} onPress={onToggle}>
      <View style={s.faqQuestionRow}>
        <Text style={s.faqQuestion}>{item.question}</Text>
        <Text style={s.faqChevron}>{isOpen ? "−" : "+"}</Text>
      </View>
      {isOpen && <Text style={s.faqAnswer}>{item.answer}</Text>}
    </Pressable>
  );
}

export function HelpScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.title}>We're here to help</Text>
      <Text style={s.subtitle}>Reach us directly for anything to do with an order, a payment, or your account.</Text>

      <View style={s.contactCard}>
        <Pressable style={s.contactRow} onPress={() => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`)}>
          <Text style={s.contactIcon}>💬</Text>
          <View style={s.contactTextBlock}>
            <Text style={s.contactLabel}>Chat on WhatsApp</Text>
            <Text style={s.contactValue}>Usually the fastest way to reach us</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
        <View style={s.divider} />
        <Pressable style={s.contactRow} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
          <Text style={s.contactIcon}>📞</Text>
          <View style={s.contactTextBlock}>
            <Text style={s.contactLabel}>Call Support</Text>
            <Text style={s.contactValue}>{SUPPORT_PHONE}</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
        <View style={s.divider} />
        <Pressable style={s.contactRow} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <Text style={s.contactIcon}>✉️</Text>
          <View style={s.contactTextBlock}>
            <Text style={s.contactLabel}>Email Us</Text>
            <Text style={s.contactValue}>{SUPPORT_EMAIL}</Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      </View>

      <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
      <View style={s.faqCard}>
        {FAQS.map((item, index) => (
          <View key={item.question}>
            {index > 0 && <View style={s.divider} />}
            <FaqRow item={item} isOpen={openIndex === index} onToggle={() => setOpenIndex(openIndex === index ? null : index)} s={s} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: theme.spacing(2), paddingBottom: theme.spacing(4) },
    title: { fontSize: 20, fontWeight: "800", color: colors.text },
    subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: theme.spacing(2), lineHeight: 18 },
    contactCard: { backgroundColor: colors.surface, borderRadius: theme.radius, overflow: "hidden", marginBottom: theme.spacing(2.5) },
    contactRow: { flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(1.75) },
    contactIcon: { fontSize: 20, marginRight: theme.spacing(1.5) },
    contactTextBlock: { flex: 1 },
    contactLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
    contactValue: { fontSize: 12, color: colors.muted, marginTop: 2 },
    chevron: { fontSize: 20, color: colors.muted, fontWeight: "800" },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: theme.spacing(1.75) + 20 + theme.spacing(1.5) },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: theme.spacing(1),
    },
    faqCard: { backgroundColor: colors.surface, borderRadius: theme.radius, overflow: "hidden" },
    faqRow: { paddingVertical: theme.spacing(1.5), paddingHorizontal: theme.spacing(1.75) },
    faqQuestionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    faqQuestion: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text, marginRight: theme.spacing(1) },
    faqChevron: { fontSize: 18, fontWeight: "800", color: colors.primary },
    faqAnswer: { fontSize: 13, color: colors.muted, marginTop: theme.spacing(1), lineHeight: 19 },
  });
