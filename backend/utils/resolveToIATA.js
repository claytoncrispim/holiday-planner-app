import LOCATION_OVERRIDES from "../data/locationOverrides.js";
import getAmadeusToken from "./getAmadeusToken.js";
import normaliseKey from "./normaliseKey.js";

// --- Airport / city resolver using Amadeus ---
// Helper: Normalises a user string into an IATA code, preferring CITY then AIRPORT.
async function resolveToIATA(raw) {
  if (!raw) return null;

  const query = String(raw).trim();
  if (!query) return null;

  const qLower = normaliseKey(query);

  // 1) Manual overrides for known tricky places
  const override = LOCATION_OVERRIDES[qLower];

  if (override) {
    return {
      raw: query,
      iataCode: override.iataCode,
      name: override.name,
      city: override.city,
      country: override.country,
      source: "override",
    };
  }

  // 2) If user already typed a 3-letter code, just accept it
  if (/^[A-Za-z]{3}$/.test(query)) {
    return {
      raw: query,
      iataCode: query.toUpperCase(),
      name: query.toUpperCase(),
      city: null,
      country: null,
      source: "user-code",
    };
  }

  const token = await getAmadeusToken();

  // Small helper to call Amadeus locations endpoint
  async function searchLocations(subType) {
    const url = new URL(
      "https://test.api.amadeus.com/v1/reference-data/locations"
    );
    url.searchParams.set("keyword", query);
    url.searchParams.set("subType", subType);
    url.searchParams.set("page[limit]", "10");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Amadeus locations error:", data);
      return [];
    }
    // Return array of location objects or empty array
    return Array.isArray(data.data) ? data.data : [];
  }

  // 3) Try to resolve as a CITY first (e.g. DUB for Dublin, not DBN)
  let locations = await searchLocations("CITY");

  // 4) If no city found, fall back to AIRPORT + CITY
  if (locations.length === 0) {
    locations = await searchLocations("AIRPORT,CITY");
  }

  if (locations.length === 0) {
    console.warn("No Amadeus locations found for query:", query);
    return null;
  }

  // 5) Rank candidates: prefer exact city/name match, non-US, CITY over AIRPORT.
  locations.sort((a, b) => {
    const aName = normaliseKey(a.name || "");
    const aCity = normaliseKey(a.address?.cityName || "");
    const bName = normaliseKey(b.name || "");
    const bCity = normaliseKey(b.address?.cityName || "");

    //  Prefer exact match on city or name first by score
    const aExact = aCity === qLower || aName === qLower ? 1 : 0;
    const bExact = bCity === qLower || bName === qLower ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    // Prefer non-US when ambiguous (so "Dublin" → Ireland, not Georgia)
    const aUS = a.address?.countryCode === "US" ? 1 : 0;
    const bUS = b.address?.countryCode === "US" ? 1 : 0;
    if (aUS !== bUS) return aUS - bUS; // 0 (non-US) wins over 1 (US)

    // Prefer CITY over AIRPORT for flight search (city code covers all airports)
    const typeScore = (loc) =>
      loc.subType === "CITY" ? 2 : loc.subType === "AIRPORT" ? 1 : 0;

    return typeScore(b) - typeScore(a);
  });

  const best = locations[0];

  return {
    raw: query,
    iataCode: best.iataCode,
    name: best.name,
    city: best.address?.cityName || null,
    country: best.address?.countryCode || null,
    source: "amadeus",
  };
}

export default resolveToIATA;