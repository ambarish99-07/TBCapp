import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./jwt.js";

export function requireAuth(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    try {
      req.user = verifyAccessToken(header.slice("Bearer ".length), jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

/** Mount after requireAuth. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/**
 * For routes that support both guest and registered-user flows (e.g. order
 * creation): attaches req.user if a valid bearer token is present, but never
 * rejects the request if it's absent or invalid.
 */
export function optionalAuth(jwtSecret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        req.user = verifyAccessToken(header.slice("Bearer ".length), jwtSecret);
      } catch {
        // ignore — treated as a guest
      }
    }
    next();
  };
}
