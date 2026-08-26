export interface AddressSuggestion {
  id: string;
  displayName: string;
  address: string;
  area?: string;
  city: string;
  pincode?: string;
  lat: number;
  lon: number;
}

// Patna's rough bounding box — keeps results scoped to the one city this app delivers in.
const PATNA_VIEWBOX = "85.02,25.70,85.25,25.52";

/**
 * No paid geocoding/places API is configured for this project (same constraint noted in
 * apps/api's deliveryZone.ts) — this uses OpenStreetMap's free public Nominatim endpoint
 * instead, which needs no API key. It's rate-limited by Nominatim's own usage policy, hence
 * the debounce at the call site; swap for Google Places/Mapbox if this ever needs to scale.
 */
export async function searchPatnaAddresses(query: string): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    limit: "8",
    countrycodes: "in",
    viewbox: PATNA_VIEWBOX,
    bounded: "1",
    q: query,
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Address search failed");

  const results = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    address?: {
      house_number?: string;
      road?: string;
      suburb?: string;
      neighbourhood?: string;
      city?: string;
      town?: string;
      village?: string;
      state_district?: string;
      postcode?: string;
    };
  }>;

  return results.map((result) => {
    const addr = result.address ?? {};
    return {
      id: String(result.place_id),
      displayName: result.display_name,
      address: [addr.house_number, addr.road].filter(Boolean).join(" ") || result.display_name.split(",")[0],
      area: addr.suburb ?? addr.neighbourhood ?? addr.state_district,
      city: addr.city ?? addr.town ?? addr.village ?? "Patna",
      pincode: addr.postcode,
      lat: Number(result.lat),
      lon: Number(result.lon),
    };
  });
}

/** Turns a dropped/dragged map pin's coordinates back into an address — same free Nominatim
 * endpoint as the search above, just its `/reverse` counterpart. */
export async function reverseGeocode(lat: number, lon: number): Promise<AddressSuggestion> {
  const params = new URLSearchParams({ format: "json", addressdetails: "1", lat: String(lat), lon: String(lon) });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Reverse geocoding failed");

  const result = (await response.json()) as {
    place_id: number;
    display_name: string;
    address?: {
      house_number?: string;
      road?: string;
      suburb?: string;
      neighbourhood?: string;
      city?: string;
      town?: string;
      village?: string;
      state_district?: string;
      postcode?: string;
    };
  };
  const addr = result.address ?? {};
  return {
    id: String(result.place_id),
    displayName: result.display_name,
    address: [addr.house_number, addr.road].filter(Boolean).join(" ") || result.display_name.split(",")[0],
    area: addr.suburb ?? addr.neighbourhood ?? addr.state_district,
    city: addr.city ?? addr.town ?? addr.village ?? "Patna",
    pincode: addr.postcode,
    lat,
    lon,
  };
}
