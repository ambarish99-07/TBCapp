import type { Env } from "../../config/env.js";
import { sendWhatsAppTemplateMessage, WhatsAppNotConfiguredError } from "./waClient.js";
import { WHATSAPP_TEMPLATES } from "./templates.js";

interface OrderAlertInfo {
  orderNumber: string;
  total: number;
  customerName: string;
}

/**
 * Fires once an order is genuinely confirmed: immediately for COD, only after
 * payment verification succeeds for online payment. Must never throw or block
 * the order-creation/payment-verification flow it's attached to — if credentials
 * aren't configured yet, this logs and returns rather than failing the request.
 */
export async function sendNewOrderAlert(env: Env, order: OrderAlertInfo): Promise<void> {
  if (!env.WHATSAPP_BUSINESS_OWNER_NUMBER) {
    console.log(`[whatsapp] skipping new-order alert (not configured) for order ${order.orderNumber}`);
    return;
  }

  try {
    await sendWhatsAppTemplateMessage(env, {
      to: env.WHATSAPP_BUSINESS_OWNER_NUMBER,
      templateName: WHATSAPP_TEMPLATES.NEW_ORDER_ALERT,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: order.orderNumber },
            { type: "text", text: order.customerName },
            { type: "text", text: `Rs. ${order.total}` },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      console.log(`[whatsapp] skipping new-order alert (not configured) for order ${order.orderNumber}`);
      return;
    }
    console.error(`[whatsapp] failed to send new-order alert for order ${order.orderNumber}:`, err);
  }
}
