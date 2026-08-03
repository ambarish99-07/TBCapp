import { randomBytes } from "node:crypto";

/**
 * A separate, cryptographically random public identifier for guest order lookup.
 * Deliberately not the Mongo _id — ObjectIds are sequential/time-derived enough
 * to be guessable/enumerable, which would let someone browse other customers'
 * orders via a confirmation-page URL.
 */
export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}
