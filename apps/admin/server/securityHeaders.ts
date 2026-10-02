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
 *
 * `apiOrigins` (e.g. the app API's origin, plus the separate website API's origin used by the
 * sidebar's cross-login) are needed once those APIs are deployed standalone instead of being
 * reverse-proxied under this same origin — with a bare `connect-src 'self'`, fetch/XHR calls to a
 * different-origin API get silently blocked by the browser's CSP, not CORS, which is a confusing
 * failure mode (the request never leaves the browser, no CORS error to see).
 */
export function securityHeaders(nodeEnv: string, apiOrigins: string[] = []): RequestHandler {
  const isProduction = nodeEnv === "production";

  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "https:", "data:"],
        connectSrc: isProduction
          ? ["'self'", ...apiOrigins]
          : ["'self'", "ws://localhost:*", "http://localhost:*"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: isProduction ? { maxAge: 15552000 } : false,
  });
}
