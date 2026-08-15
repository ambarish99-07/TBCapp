import type { Env } from "../../config/env.js";
import { sendWhatsAppTemplateMessage, WhatsAppNotConfiguredError } from "./waClient.js";
import { WHATSAPP_TEMPLATES } from "./templates.js";

interface PremiumMembershipAlertInfo {
  orderNumber: string;
  customerName: string;
  expiresAt: string;
}

/**
 * Fires once a Premium Membership purchase is confirmed. COD fires immediately; a razorpay
 * purchase only fires this after payment verification succeeds (see premiumMembership.service.ts).
 * Must never throw or block the purchase flow — if credentials aren't configured yet, this logs
 * and returns rather than failing the request.
 */
export async function sendNewPremiumMembershipAlert(env: Env, purchase: PremiumMembershipAlertInfo): Promise<void> {
  if (!env.WHATSAPP_BUSINESS_OWNER_NUMBER) {
    console.log(`[whatsapp] skipping new-premium-membership alert (not configured) for ${purchase.orderNumber}`);
    return;
  }

  try {
    await sendWhatsAppTemplateMessage(env, {
      to: env.WHATSAPP_BUSINESS_OWNER_NUMBER,
      templateName: WHATSAPP_TEMPLATES.NEW_PREMIUM_MEMBERSHIP_ALERT,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: purchase.orderNumber },
            { type: "text", text: purchase.customerName },
            { type: "text", text: purchase.expiresAt },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      console.log(`[whatsapp] skipping new-premium-membership alert (not configured) for ${purchase.orderNumber}`);
      return;
    }
    console.error(`[whatsapp] failed to send new-premium-membership alert for ${purchase.orderNumber}:`, err);
  }
}
