import type { Env } from "../../config/env.js";
import { sendWhatsAppTemplateMessage, WhatsAppNotConfiguredError } from "./waClient.js";
import { WHATSAPP_TEMPLATES } from "./templates.js";

interface TiffinSubscriptionAlertInfo {
  subscriptionNumber: string;
  customerName: string;
  planName: string;
}

/**
 * Fires once a GG Tiffin subscription is created (COD-only in Phase 1, so this fires
 * immediately, same as a COD order alert). Must never throw or block the subscribe flow —
 * if credentials aren't configured yet, this logs and returns rather than failing the request.
 */
export async function sendNewTiffinSubscriptionAlert(env: Env, subscription: TiffinSubscriptionAlertInfo): Promise<void> {
  if (!env.WHATSAPP_BUSINESS_OWNER_NUMBER) {
    console.log(`[whatsapp] skipping new-tiffin-subscription alert (not configured) for ${subscription.subscriptionNumber}`);
    return;
  }

  try {
    await sendWhatsAppTemplateMessage(env, {
      to: env.WHATSAPP_BUSINESS_OWNER_NUMBER,
      templateName: WHATSAPP_TEMPLATES.NEW_TIFFIN_SUBSCRIPTION_ALERT,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: subscription.subscriptionNumber },
            { type: "text", text: subscription.customerName },
            { type: "text", text: subscription.planName },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      console.log(`[whatsapp] skipping new-tiffin-subscription alert (not configured) for ${subscription.subscriptionNumber}`);
      return;
    }
    console.error(`[whatsapp] failed to send new-tiffin-subscription alert for ${subscription.subscriptionNumber}:`, err);
  }
}
