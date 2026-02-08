import LOCATION_OVERRIDES from "../data/locationOverrides.js";
import getAmadeusToken from "./getAmadeusToken.js";
import normaliseKey from "./normaliseKey.js";
import { resolveErrorType } from "./resolveResult.js"

// --- Airport / city resolver using Amadeus ---
// Helper: Normalises a user string into an IATA code, preferring CITY then AIRPORT.
async function resolveToIATA(raw) {
  try {
    if (!raw) { 
      return { 
        result: null, 
        errorType: resolveErrorType.NOT_FOUND 
      };
    }
    
    const query = String(raw).trim();
    if (!query) {
      return { 
        result: null, 
        errorType: resolveErrorType.NOT_FOUND 
      };
    }

    const qLower = normaliseKey(query);
    
    // 1) Manual overrides for known tricky places
    const override = LOCATION_OVERRIDES[qLower];
    if (override) {
      return {
        result: {
          raw: query,
          iataCode: override.iataCode,
          name: override.name,
          city: override.city,
          country: override.country,
          source: "override",
        },
        errorType: resolveErrorType.NONE,
      };
    }

    // 2) If user already typed a 3-letter code, just accept it
    if (/^[A-Za-z]{3}$/.test(query)) {
      return {
        result: {
          raw: query,
          iataCode: query.toUpperCase(),
          name: query.toUpperCase(),
          city: null,
          country: null,
          source: "user-code",
        },
        errorType: resolveErrorType.NONE,
      };
    }

    const token = await getAmadeusToken();
  
    // Small helper to call Amadeus locations endpoint
    async function searchLocations(subType) {
      try {
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

      //  If provider returns 5xx, treat as unavailable
      if (res.status >= 500) {
        const data = await safeJson(res);
        console.error("Amadeus locations 5xx:", res.status, data);
        return {
          locations: null,
          errorType: resolveErrorType.UPSTREAM_UNAVAILABLE
        };
      }
      
      const data = await safeJson(res);

      // Non-ok but not 5xx => bad response or rejected request (e.g. rate limit).
      if (!res.ok) {
        console.error("Amadeus locations error:", res.status, data);
        return {
          locations: null,
          errorType: resolveErrorType.UPSTREAM_BAD_RESPONSE
        };
      }
      
      // ok but unexpected format
      const arr = Array.isArray(data?.data) ? data.data : null;
      if (!arr) {
        console.error("Amadeus locations unexpected format:", data);
        return {
          locations: null,
          errorType: resolveErrorType.UPSTREAM_BAD_RESPONSE
        };
      }

      return {
        locations: arr,
        errorType: resolveErrorType.NONE
      };
     } catch (err) {
        // Network or fetch error => log and treat as upstream unavailable
        console.error("Amadeus locations fetch error:", err);
        return {
          locations: null,
          errorType: resolveErrorType.UPSTREAM_UNAVAILABLE
        };
     }
    }
    
    // 3 Try to resolve as a CITY first (e.g. DUB for Dublin, not DBN)
    let out = await searchLocations("CITY");
    if (out.errorType !== resolveErrorType.NONE) {
      return {
        result: null,
        errorType: out.errorType
      };
    }
    let locations = out.locations;

    // 4 If no city found, fall back to AIRPORT + CITY
    if (locations.length === 0) {
      out = await searchLocations("AIRPORT,CITY");
      if (out.errorType !== resolveErrorType.NONE) {
        return {
          result: null,
          errorType: out.errorType
        };
      }
      locations = out.locations;
    }

    if (locations.length === 0) {
      console.warn("No Amadeus locations found for query:", query);
      return { 
        result: null, 
        errorType: resolveErrorType.NOT_FOUND 
      };
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
      result: {
        raw: query,
        iataCode: best.iataCode,
        name: best.name,
        city: best.address?.cityName || null,
        country: best.address?.countryCode || null,
        source: "amadeus",
      },
      errorType: resolveErrorType.NONE,
    };  
  } catch (err) {
    console.error("resolveToIATA unexpected error:", err);
    return {
      result: null,
      errorType: resolveErrorType.INTERNAL_ERROR
    }; 
  }
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch (err) {
    return null;
  }
}


export default resolveToIATA;