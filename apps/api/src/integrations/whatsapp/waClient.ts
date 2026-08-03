import type { Env } from "../../config/env.js";

export class WhatsAppNotConfiguredError extends Error {}

interface TemplateMessageParams {
  to: string;
  templateName: string;
  components?: unknown[];
}

/**
 * Thin wrapper around the WhatsApp Business Platform (Cloud API). Any real use
 * requires a verified Meta Business account and pre-approved message templates —
 * there is no unofficial-but-safe way to proactively message a customer. Callers
 * (sendOrderAlert, sendRecommendation) are responsible for catching
 * WhatsAppNotConfiguredError and any network error and never letting it propagate.
 */
export async function sendWhatsAppTemplateMessage(env: Env, params: TemplateMessageParams): Promise<void> {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new WhatsAppNotConfiguredError("WhatsApp credentials are not configured");
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "template",
      template: {
        name: params.templateName,
        language: { code: "en" },
        components: params.components ?? [],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp Cloud API error ${response.status}: ${body}`);
  }
}
