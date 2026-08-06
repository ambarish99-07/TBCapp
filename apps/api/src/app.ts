import cors from "cors";
import express, { type Express } from "express";
// Patches Express's router so a rejected promise inside an async handler is
// forwarded to the error middleware via next(err) — without this, Express 4
// silently drops the error and the request just hangs until the client times
// out (this is exactly what an uncaught Mongoose validation error did before).
import "express-async-errors";
import { securityHeaders } from "./config/security.js";
import type { Env } from "./config/env.js";
import { createAdminRouter } from "./modules/admin/admin.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createMenuRouter } from "./modules/menu/menu.routes.js";
import { createOrdersRouter } from "./modules/orders/orders.routes.js";
import { createPaymentsRouter } from "./modules/payments/payments.routes.js";
import { createErrorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

export function createApp(env: Env): Express {
  const app = express();

  app.use(securityHeaders(env));
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
  app.use("/menu", createMenuRouter(env));
  app.use("/orders", createOrdersRouter(env));
  app.use("/payments", createPaymentsRouter(env));
  app.use("/admin", createAdminRouter(env));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(createErrorHandler(env));

  return app;
}
