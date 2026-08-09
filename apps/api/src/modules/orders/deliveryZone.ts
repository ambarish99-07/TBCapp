import type { DeliveryDetails } from "@tbc/shared-types";
import { OrderValidationError } from "./orders.errors.js";

/**
 * The Blenders Club is a single cloud kitchen — there's no real geocoding/maps
 * API configured (no key in env), so this stays an honest, simple check
 * against the one city it delivers in, plus the same self-reported distance
 * field already used for premium free-delivery eligibility. Swap in real
 * geofencing once a maps provider is wired up.
 */
export const SUPPORTED_CITY = "Patna";
export const MAX_DELIVERY_RADIUS_KM = 12;

/** Applies to whichever address is on the order — the customer's own, or a recipient's. */
export function assertWithinDeliveryZone(delivery: DeliveryDetails): void {
  if (delivery.city.trim().toLowerCase() !== SUPPORTED_CITY.toLowerCase()) {
    throw new OrderValidationError(
      `Sorry, we don't deliver to ${delivery.city} yet — we're currently only serving ${SUPPORTED_CITY}.`
    );
  }
  if (delivery.distanceFromShopKm != null && delivery.distanceFromShopKm > MAX_DELIVERY_RADIUS_KM) {
    throw new OrderValidationError(
      `That address is outside our ${MAX_DELIVERY_RADIUS_KM}km delivery radius.`
    );
  }
}
