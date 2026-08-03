import { randomBytes } from "node:crypto";

function randomAlnum(length: number): string {
  return randomBytes(length).toString("hex").toUpperCase().slice(0, length);
}

export function generateOrderNumber(): string {
  return `TBC-${randomAlnum(8)}-${randomAlnum(4)}`;
}
