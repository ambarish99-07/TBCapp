import helmet from "helmet";
import type { RequestHandler } from "express";
import type { Env } from "./env.js";

/**
 * This API is a pure JSON service (no HTML rendering), so CSP matters far less here
 * than in apps/admin's actual web page — but HSTS/nosniff/frameguard are cheap and
 * worth keeping on by default. apps/admin owns the real CSP dev/prod split since
 * it's the one component that serves HTML.
 */
export function securityHeaders(env: Env): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: env.NODE_ENV === "production" ? { maxAge: 15552000 } : false,
  });
}
