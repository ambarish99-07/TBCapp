/**
 * Google's classic keyless embed ("output=embed") refuses to render when loaded as a WebView's
 * top-level source — it replies with "The Google Maps Embed API must be used in an iframe."
 * Wrapping it in a tiny local HTML document with a real <iframe> satisfies that check without
 * needing an API key. No lat/long is stored anywhere in this system, only text addresses, so this
 * shows the address pin only — not a live rider location (there's no real rider GPS feed here).
 */
export function mapEmbedHtml(addressLine: string): string {
  const url = `https://www.google.com/maps?q=${encodeURIComponent(addressLine)}&z=15&output=embed`;
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}</style></head>
<body><iframe src="${url}"></iframe></body></html>`;
}
