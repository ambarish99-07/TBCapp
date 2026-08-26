import type { SavedRecipient } from "@tbc/shared-types";

/** The one-line "house number, area/address, city" summary used everywhere a saved address is
 * shown compactly — the Cart header's address popup/button, the Addresses list. */
export function formatAddressLine(recipient: Pick<SavedRecipient, "houseNumber" | "area" | "address" | "city">): string {
  return [recipient.houseNumber, recipient.area || recipient.address, recipient.city].filter(Boolean).join(", ");
}
