import type { Env } from "../../config/env.js";
import { sendWhatsAppTemplateMessage, WhatsAppNotConfiguredError } from "./waClient.js";
import { WHATSAPP_TEMPLATES } from "./templates.js";

interface BulkOrderAlertInfo {
  name: string;
  phone: string;
  occasion?: string;
}

/**
 * Fires as soon as a bulk-order inquiry is saved. Best-effort, same as the
 * other WhatsApp alerts — the inquiry itself is always persisted (see
 * BulkOrderInquiry.model.ts) and visible in the admin dashboard regardless of
 * whether this send succeeds, so a business owner never depends solely on
 * WhatsApp being configured to find out about one.
 */
export async function sendBulkOrderInquiryAlert(env: Env, inquiry: BulkOrderAlertInfo): Promise<void> {
  if (!env.WHATSAPP_BUSINESS_OWNER_NUMBER) {
    console.log(`[whatsapp] skipping bulk-order inquiry alert (not configured) for ${inquiry.name}`);
    return;
  }

  try {
    await sendWhatsAppTemplateMessage(env, {
      to: env.WHATSAPP_BUSINESS_OWNER_NUMBER,
      templateName: WHATSAPP_TEMPLATES.BULK_ORDER_INQUIRY,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: inquiry.name },
            { type: "text", text: inquiry.phone },
            { type: "text", text: inquiry.occasion || "Not specified" },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      console.log(`[whatsapp] skipping bulk-order inquiry alert (not configured) for ${inquiry.name}`);
      return;
    }
    console.error(`[whatsapp] failed to send bulk-order inquiry alert for ${inquiry.name}:`, err);
  }
}
