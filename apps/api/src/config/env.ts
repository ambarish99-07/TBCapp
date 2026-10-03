import { z } from "zod";

const EnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGINS: z.string().default(""),

  // Integration credentials are intentionally optional — the app must keep working
  // with zero live payment/notification setup (see integrations/whatsapp, modules/payments).
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_OWNER_NUMBER: z.string().optional(),

  // Unset in local dev — image uploads fall back to local disk (see utils/imageUpload.ts).
  // Set on Cloud Run (and any host with an ephemeral filesystem) so uploaded images survive
  // container restarts/recycling instead of vanishing.
  GCS_BUCKET_NAME: z.string().optional(),

  // Real OTP SMS via MSG91 (integrations/sms/msg91.ts). Unset → the fixed test code 123456 is used
  // and nothing is sent (local dev, tests). AUTH_KEY is a secret (Secret Manager in production);
  // TEMPLATE_ID is MSG91's own template id (not the DLT id); OTP_VAR is the template's variable name.
  MSG91_AUTH_KEY: z.string().min(10).optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().min(5).optional(),
  MSG91_OTP_VAR: z.string().min(1).default("number"),
  // Optional fixed login for app-store reviewers, who can't receive our SMS: this one number always
  // accepts this one code and no SMS is sent. Leave unset unless a review needs it.
  OTP_REVIEW_PHONE: z.string().optional(),
  OTP_REVIEW_CODE: z.string().regex(/^\d{6}$/).optional(),

  // Catalog sync with the Lickyeat website (see modules/catalogSync). Off unless both are set.
  // PEER_URL = the website API's public base URL; SECRET = the same random value on both sides.
  CATALOG_SYNC_PEER_URL: z.string().url().optional(),
  CATALOG_SYNC_SECRET: z.string().min(32, "CATALOG_SYNC_SECRET must be at least 32 characters").optional(),
  // Optional extra "appBrandId=websiteBrandId" pairs, comma-separated (TBL=the-biryani-lane is built in).
  CATALOG_SYNC_BRAND_ALIASES: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Fail fast on boot if required config is missing — never limp along with an undefined secret. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    console.error("Invalid environment configuration:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration — see logged field errors above.");
  }
  return result.data;
}
