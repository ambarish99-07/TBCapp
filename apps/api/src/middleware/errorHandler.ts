import type { ErrorRequestHandler } from "express";
import type { Env } from "../config/env.js";

export function createErrorHandler(env: Env): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    console.error(err);
    const message = env.NODE_ENV === "production" ? "Internal server error" : (err as Error).message;
    res.status(500).json({ error: message });
  };
}
