import cors from "cors";
import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Patches Express's router so a rejected promise inside an async handler is
// forwarded to the error middleware via next(err) — without this, Express 4
// silently drops the error and the request just hangs until the client times
// out (this is exactly what an uncaught Mongoose validation error did before).
import "express-async-errors";
import { securityHeaders } from "./config/security.js";
import type { Env } from "./config/env.js";
import { createAdminRouter } from "./modules/admin/admin.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createBrandsRouter } from "./modules/brands/brands.routes.js";
import { createBulkOrdersRouter } from "./modules/bulkOrders/bulkOrders.routes.js";
import { createCouponsRouter } from "./modules/coupons/coupons.routes.js";
import { createMenuRouter } from "./modules/menu/menu.routes.js";
import { createOrdersRouter } from "./modules/orders/orders.routes.js";
import { createPaymentsRouter } from "./modules/payments/payments.routes.js";
import { createRecipientsRouter } from "./modules/recipients/recipients.routes.js";
import { createTiffinRouter } from "./modules/tiffin/tiffin.routes.js";
import { createPremiumMembershipRouter } from "./modules/premiumMembership/premiumMembership.routes.js";
import { createStoreSettingsRouter } from "./modules/storeSettings/storeSettings.routes.js";
import { createErrorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Real menu photography, served directly (no CORS/auth needed for <img> tags).
// Lives as a sibling of both src/ (dev, via tsx) and dist/ (production build).
const PUBLIC_DIR = path.join(__dirname, "../public");

export function createApp(env: Env): Express {
  const app = express();

  app.use(securityHeaders(env));
  app.use("/menu-images", express.static(path.join(PUBLIC_DIR, "menu-images")));
  app.use("/brand-images", express.static(path.join(PUBLIC_DIR, "brand-images")));
  app.use("/tiffin-images", express.static(path.join(PUBLIC_DIR, "tiffin-images")));
  app.use(
    cors({
      origin: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    })
  );
  // A well-formed order payload (50 lines, delivery details) fits comfortably
  // under this; the cap exists to reject abusive oversized bodies, not to be
  // generous headroom.
  app.use(express.json({ limit: "256kb" }));
  app.use(requestLogger);

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", createAuthRouter(env));
  app.use("/brands", createBrandsRouter(env));
  app.use("/menu", createMenuRouter(env));
  app.use("/orders", createOrdersRouter(env));
  app.use("/payments", createPaymentsRouter(env));
  app.use("/admin", createAdminRouter(env));
  app.use("/me/recipients", createRecipientsRouter(env));
  app.use("/bulk-order-inquiries", createBulkOrdersRouter(env));
  app.use("/tiffin", createTiffinRouter(env));
  app.use("/premium-membership", createPremiumMembershipRouter(env));
  app.use("/coupons", createCouponsRouter(env));
  app.use("/store", createStoreSettingsRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(createErrorHandler(env));

  return app;
}
