/**
 * Customer support contact details — plain constants, not fetched from the API, since this is
 * static business info that changes rarely and doesn't need a backend round-trip to display.
 * Update these three lines once real support channels exist (a support number, and — once the
 * WhatsApp Business Platform integration in apps/api/src/integrations/whatsapp is actually
 * configured — the same number works for both tel/sms and the wa.me chat link below).
 */
export const SUPPORT_PHONE = "+919999999999";
export const SUPPORT_WHATSAPP_NUMBER = "919999999999"; // wa.me wants digits only, country code, no "+"
export const SUPPORT_EMAIL = "support@lickyeat.example";
