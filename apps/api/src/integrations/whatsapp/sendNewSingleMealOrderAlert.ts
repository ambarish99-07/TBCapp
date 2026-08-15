import type { Env } from "../../config/env.js";
import { sendWhatsAppTemplateMessage, WhatsAppNotConfiguredError } from "./waClient.js";
import { WHATSAPP_TEMPLATES } from "./templates.js";

interface SingleMealOrderAlertInfo {
  orderNumber: string;
  customerName: string;
  dishName: string;
}

/**
 * Fires once a GG Tiffin single-meal order is created. COD fires immediately; a razorpay order
 * only fires this after payment verification succeeds (see singleMeal.service.ts). Must never
 * throw or block the order flow — if credentials aren't configured yet, this logs and returns.
 */
export async function sendNewSingleMealOrderAlert(env: Env, order: SingleMealOrderAlertInfo): Promise<void> {
  if (!env.WHATSAPP_BUSINESS_OWNER_NUMBER) {
    console.log(`[whatsapp] skipping new-single-meal-order alert (not configured) for ${order.orderNumber}`);
    return;
  }

  try {
    await sendWhatsAppTemplateMessage(env, {
      to: env.WHATSAPP_BUSINESS_OWNER_NUMBER,
      templateName: WHATSAPP_TEMPLATES.NEW_SINGLE_MEAL_ORDER_ALERT,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: order.orderNumber },
            { type: "text", text: order.customerName },
            { type: "text", text: order.dishName },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof WhatsAppNotConfiguredError) {
      console.log(`[whatsapp] skipping new-single-meal-order alert (not configured) for ${order.orderNumber}`);
      return;
    }
    console.error(`[whatsapp] failed to send new-single-meal-order alert for ${order.orderNumber}:`, err);
  }
}
