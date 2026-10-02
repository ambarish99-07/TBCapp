import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { securityHeaders } from "./securityHeaders.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const port = Number(process.env.PORT) || 5173;
const nodeEnv = process.env.NODE_ENV ?? "production";

// Same env var names Vite reads at build time (src/api/adminClient.ts, src/api/websiteClient.ts) —
// one set of variables, not two, so the CSP's connect-src can't drift out of sync with the API URLs
// the browser actually calls.
function originOf(url: string | undefined): string | undefined {
  return url && /^https?:\/\//.test(url) ? new URL(url).origin : undefined;
}
const apiOrigins = [originOf(process.env.VITE_API_BASE_URL), originOf(process.env.VITE_WEBSITE_API_BASE_URL)].filter(
  (o): o is string => Boolean(o),
);

const app = express();
app.use(securityHeaders(nodeEnv, apiOrigins));
app.use(express.static(distDir));

// SPA fallback — any unmatched route serves index.html so react-router can take over client-side.
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  console.log(`TBC admin dashboard serving dist/ on port ${port}`);
});
