import helmet from "helmet";
import type { RequestHandler } from "express";

/**
 * This is the one actual web-facing HTML component in the whole app, so it's
 * where the spec's CSP/HSTS/X-Frame-Options/Permissions-Policy requirements get
 * enforced. The dev/prod split matters here specifically: Vite's dev server (and
 * React's dev-mode eval-based fast refresh) needs 'unsafe-eval' and a websocket
 * connect-src for HMR, and a production-strict CSP applied in dev is a known way
 * to make the app silently fail to render with no obvious error. Production gets
 * the real strict policy; nothing else changes between the two.
 */
export function securityHeaders(nodeEnv: string): RequestHandler {
  const isProduction = nodeEnv === "production";

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "https:", "data:"],
        connectSrc: isProduction ? ["'self'"] : ["'self'", "ws://localhost:*", "http://localhost:*"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: isProduction ? { maxAge: 15552000 } : false,
  });
}
