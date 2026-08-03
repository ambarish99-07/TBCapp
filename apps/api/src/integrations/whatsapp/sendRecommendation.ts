import type { Env } from "../../config/env.js";
import { sendWhatsAppTemplateMessage, WhatsAppNotConfiguredError } from "./waClient.js";
import { WHATSAPP_TEMPLATES } from "./templates.js";

interface RecommendationInfo {
  customerPhone: string;
  recommendedItemNames: string[];
}

/**
 * Sends a purchase-history-based product recommendation. The scoring itself
 * (getRecommendations from @tbc/pricing) is a pure function computed by the
 * caller — this function only ever handles the message-sending side effect, so
 * a future scheduled/automatic version can reuse the same scoring untouched.
 */
export async function sendProductRecommendation(env: Env, params: RecommendationInfo): Promise<void> {
  if (params.recommendedItemNames.length === 0) return;

  try {
    await sendWhatsAppTemplateMessage(env, {
      to: params.customerPhone,
      templateName: WHATSAPP_TEMPLATES.PRODUCT_RECOMMENDATION,
      components: [
        {
          type: "body",
          parameters: params.recommendedItemNames.map((name) => ({ type: "text", text: name })),
        },
      ],
    });
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      console.log("[whatsapp] skipping product recommendation (not configured)");
      return;
    }
    console.error("[whatsapp] failed to send product recommendation:", err);
  }
}
