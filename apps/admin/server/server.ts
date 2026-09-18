import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { securityHeaders } from "./securityHeaders.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const port = Number(process.env.PORT) || 5173;
const nodeEnv = process.env.NODE_ENV ?? "production";

// Same env var name Vite reads at build time (see src/api/adminClient.ts) — one variable to set,
// not two, so the CSP's connect-src can't drift out of sync with the API URL actually being called.
const apiBaseUrl = process.env.VITE_API_BASE_URL;
const apiOrigin = apiBaseUrl && /^https?:\/\//.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : undefined;

const app = express();
app.use(securityHeaders(nodeEnv, apiOrigin));
app.use(express.static(distDir));

// SPA fallback — any unmatched route serves index.html so react-router can take over client-side.
app.get("*", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(port, () => {
  console.log(`TBC admin dashboard serving dist/ on port ${port}`);
});
