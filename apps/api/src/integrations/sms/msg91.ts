import type { Env } from "../../config/env.js";

/**
 * OTP SMS through MSG91's Flow API, using the DLT-approved OTP template (header LICKYE).
 *
 *   POST https://control.msg91.com/api/v5/flow
 *   headers: authkey: <MSG91_AUTH_KEY>
 *   body:    { template_id, short_url: "0", recipients: [{ mobiles: "91XXXXXXXXXX", <var>: "<code>" }] }
 *
 * `<var>` is the variable name used in the template on MSG91 (MSG91_OTP_VAR, default "number" —
 * the template's ##number##). MSG91 can answer HTTP 200 with `{"type":"error"}`, so both are checked.
 */

export class SmsNotConfiguredError extends Error {}
export class SmsSendError extends Error {}

const FLOW_URL = "https://control.msg91.com/api/v5/flow";

export function smsConfigured(env: Env): boolean {
  return Boolean(env.MSG91_AUTH_KEY && env.MSG91_OTP_TEMPLATE_ID);
}

/** "+91 98765-43210" / "098765 43210" / "9876543210" → "9876543210"; null if not an Indian mobile. */
export function toIndianMobile(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export async function sendOtpSms(env: Env, mobile10: string, code: string): Promise<void> {
  if (!smsConfigured(env)) throw new SmsNotConfiguredError("MSG91 is not configured");
  let res: Response;
  try {
    res = await fetch(FLOW_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json", authkey: env.MSG91_AUTH_KEY! },
      body: JSON.stringify({
        template_id: env.MSG91_OTP_TEMPLATE_ID,
        short_url: "0",
        recipients: [{ mobiles: `91${mobile10}`, [env.MSG91_OTP_VAR || "number"]: code }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new SmsSendError(`MSG91 unreachable: ${err instanceof Error ? err.message : "network error"}`);
  }
  const text = await res.text();
  let body: { type?: string; message?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    // MSG91 normally answers JSON; anything else is treated by status code alone.
  }
  if (!res.ok || body.type === "error") {
    // Never log the auth key or the code; the last 4 digits identify the number well enough.
    throw new SmsSendError(`MSG91 refused the OTP SMS to ******${mobile10.slice(-4)}: ${res.status} ${body.message ?? text.slice(0, 200)}`);
  }
}
