import { randomBytes } from "node:crypto";

function randomAlnum(length: number): string {
  return randomBytes(length).toString("hex").toUpperCase().slice(0, length);
}

export function generateSubscriptionNumber(): string {
  return `GT-${randomAlnum(8)}-${randomAlnum(4)}`;
}
