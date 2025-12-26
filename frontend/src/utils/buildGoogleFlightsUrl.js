// --- HELPER ---
// Helper to build Google Flights URL
const buildGoogleFlightsUrl = ({
  originName,
  destinationName,
  departureDate,
  returnDate,
  totalPassengers,
  flight,
}) => {
  // Try to infer origin/destination from multiple sources
  const effectiveOrigin =
    originName ||
    flight?.departureAirport ||      // e.g. "Dublin Airport (DUB)"
    flight?.from ||
    "";

  const effectiveDestination =
    destinationName ||
    flight?.arrivalAirport ||        // e.g. "Rome–Fiumicino (FCO)"
    flight?.to ||
    "";

  // Build date text (Google often ignores this for the UI,
  // but it still makes the query more precise)
  let datePart = "";
  if (departureDate && returnDate) {
    datePart = ` on ${departureDate} to ${returnDate}`;
  } else if (departureDate) {
    datePart = ` on ${departureDate}`;
  }

  // Build passengers text
  let paxPart = "";
  if (typeof totalPassengers === "number" && totalPassengers > 0) {
    paxPart = ` for ${totalPassengers} passenger${
      totalPassengers > 1 ? "s" : ""
    }`;
  }

  // If we still don’t have a clear origin, at least search “flights to X…”
  if (!effectiveOrigin && !effectiveDestination) {
    // absolute worst case: just open generic flights search
    return "https://www.google.com/flights";
  }

  if (!effectiveOrigin && effectiveDestination) {
    const q = encodeURIComponent(
      `Flights to ${effectiveDestination}${datePart}${paxPart}`
    );
    return `https://www.google.com/flights?q=${q}`;
  }

  // Normal case: origin and destination known
  const query = `Flights from ${effectiveOrigin} to ${effectiveDestination}${datePart}${paxPart}`;
  const encoded = encodeURIComponent(query.trim());

  return `https://www.google.com/flights?q=${encoded}`;
};

export { buildGoogleFlightsUrl };