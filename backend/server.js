import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";
import resolveToIATA from "./utils/resolveToIATA.js";
import getAmadeusToken from "./utils/getAmadeusToken.js";
import fetchWeatherForecast from "./utils/fetchWeatherForecast.js";
import { apiError, asyncHandler} from "./utils/http.js";
import isIsoDate from "./utils/isIsoDate.js";
import isIataCode from "./utils/isIataCode.js";
import { resolveErrorType } from "./utils/resolveResult.js";

// Load config from .env
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PORT = process.env.PORT || 8080;

const app = express();
app.use(cors());
app.use(express.json());

const PROJECT_ID = "holiday-planner-app-2";

// --- GOOGLE API ROUTES ---
// Endpoint to generate image using Google Imagen API
app.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;

  try {
    // Decide where to get service account credentials from
    let authOptions;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Render / production: credentials from env
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      } catch (parseErr) {
        console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", parseErr);
        throw new Error("SERVICE_ACCOUNT_JSON_PARSE_ERROR");
      }

      authOptions = {
        credentials: serviceAccount,
        projectId: serviceAccount.project_id || PROJECT_ID,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      };

      console.log("Using service account credentials from env.");
    } else {
      // Local dev: fall back to key file
      authOptions = {
        keyFile: "./service-account.json",
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      };

      console.log("Using local service-account.json key file.");
    }

    const auth = new GoogleAuth(authOptions);
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1 },
        }),
      }
    );

    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error("Imagen backend error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// --- GENERATE GUIDE ROUTE ---
// Endpoint to generate travel guide using Google Gemini API
app.post("/generate-guide", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    // Extract Gemini text
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return res.status(500).json({ error: "No text returned from Gemini." });
    }

    // Clean Markdown code fences if present
    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("Gemini returned invalid JSON:", text);
      return res.status(500).json({ error: "Gemini returned invalid JSON format" });
    }

    // Simulate delay for testing loading states
    // await new Promise(res => setTimeout(res, 1500)); // <-- UNCOMMENT THIS LINE TO SIMULATE DELAY

    // Send parsed JSON to frontend
    res.json(parsed);
  } catch (err) {
    console.error("Gemini backend error:", err);
    res.status(500).json({ error: err.toString() });
  }
});

// --- WEATHER ROUTE ---
// Example: GET /weather?destination=Lisbon
app.get("/weather", async (req, res) => {
  const { destination } = req.query;

  if (!destination) {
    return res.status(400).json({
      error: "DESTINATION_REQUIRED",
      message: "Please provide a destination query parameter.",
    });
  }

  try {
    const weather = await fetchWeatherForecast(destination);

    if (!weather.found) {
      return res.status(404).json({
        error: "DESTINATION_NOT_FOUND",
        message: weather.message,
      });
    }
    
    return res.json(weather);
  } catch (err) {
    console.error("Weather backend error:", err);
    return res.status(500).json({
      error: "WEATHER_API_ERROR",
      message: 
        "We had trouble fetching live weather data for this destination.",
    });
  }
});

// --- REAL-FLIGHTS ROUTE ---
app.get("/real-flights", asyncHandler(async (req, res) => {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    adults = "1",
  } = req.query;

  // ---- Validation ----
  const missing = [];
  if (!origin) missing.push("origin");
  if (!destination) missing.push("destination");
  if (!departureDate) missing.push("departureDate");

  if (missing.length) {
     return apiError(
       res,
       400,
       "VALIDATION_ERROR",
       `Missing required query parameters: ${missing.join(", ")}`,
       { missing }
     );
   }

  // Format checks
  if (!isIataCode(origin) || !isIataCode(destination)) {
    return apiError(
      res,
      400,
      "VALIDATION_ERROR",
      "Origin and destination must be valid IATA codes (3 uppercase letters).",
      { origin, destination }
    );
  }

  if (!isIsoDate(departureDate) || (returnDate && !isIsoDate(returnDate))) {
    return apiError(
      res,
      400,
      "VALIDATION_ERROR",
      "departureDate and returnDate must be in YYYY-MM-DD format.",
      { departureDate, returnDate }
    );
  }

  const adultsNum = Number(adults);
  if (!Number.isInteger(adultsNum) || adultsNum < 1 || adultsNum > 9) {
    return apiError(
      res,
      400,
      "VALIDATION_ERROR",
      "Adults must be an integer between 1 and 9.",
      { adults }
    );
  }

  // if (!origin || !destination || !departureDate) {
  //   return apiError(
  //     res,
  //     400,
  //     "VALIDATION_ERROR",
  //     "Missing required query parameters: origin, destination, departureDate",
  //     // Log which parameters were provided for debugging
  //     { origin: !!origin, destination: !!destination, departureDate: !!departureDate }
  //   )
  // }

  try {
    const token = await getAmadeusToken();

    const params = new URLSearchParams({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate,
        adults: String(adultsNum),
        currencyCode: "EUR",
        max: "6",
    });
  
    if (returnDate) {
      params.set("returnDate", returnDate);
    }

    const apiUrl = `https://test.api.amadeus.com/v2/shopping/flight-offers?${params.toString()}`;

    const amadeusRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const amadeusData = await amadeusRes.json();

    //  ---- Upstream error mapping ----
    if (!amadeusRes.ok) {
      // Log internal details for debugging, without leaking to the client
      console.error("AMADEUS_ERROR:", {
        status: amadeusRes.status,
        data: amadeusData
      });

      // 5xx from provider => 503 (unavailable). Otherwise 502 (bad gateway)
      const status = amadeusRes.status >= 500 ? 503 : 502;

      return apiError(
        res,
        status,
        status === 503 ? "UPSTREAM_UNAVAILABLE" : "UPSTREAM_BAD_RESPONSE",
        "Failed to fetch flight offers from provider."
      );
    }
      
    // ---- Map provider → domain offers ----
    // Map Amadeus structure: simplified objects that the UI can handle
    const offers = 
      amadeusData.data
        ?.map((offer, idx) => {
          const firstItin = offer.itineraries?.[0];
          if (!firstItin) return null;

          const segments = firstItin.segments || [];
          if (!segments.length) return null;

          const firstSeg = segments[0];
          const lastSeg = segments[segments.length - 1];
          
          return {
            id: offer.id || `amadeus-${idx}`,
            provider: "amadeus",
            airlineCode: firstSeg.carrierCode,
            flightNumber: firstSeg.number,
            departureAirport: firstSeg.departure?.iataCode,
            arrivalAirport: lastSeg.arrival?.iataCode,
            departureTime: firstSeg.departure?.at,
            arrivalTime: lastSeg.arrival?.at,
            duration: firstItin.duration, // ISO 8601 duration, e.g. "PT2H30M"
            stops: Math.max(0, segments.length - 1),
            price: Number(offer.price?.total) || 0,
            currency: offer.price?.currency || "EUR",
          };
        })
        .filter(Boolean)// remove nulls
        .slice(0, 6) || []; // limit to 6 offers max or empty array

    return res.json({ offers });
  } catch (err) {
      console.error("Real flights route error:", err);
      return apiError(res, 500, "INTERNAL_ERROR", "Internal error searching real flights." );
  }

}));

// --- Airport resolution API ---
// GET /resolve-airports?origin=...&destination=...&compare=...
app.get("/resolve-airports", async (req, res) => {
  const { origin, destination, compare } = req.query;

  const missing = [];
  if (!origin) missing.push("origin");
  if (!destination) missing.push("destination");
  if (missing.length) {
    return apiError(
      res,
      400,
      "VALIDATION_ERROR",
      `Missing required query parameters: ${missing.join(", ")}`,
      { missing }
    );
  }

  const originStr = String(origin).trim();
  const destinationStr = String(destination).trim();
  const compareStr = compare ? String(compare).trim() : null;

  if (!originStr || !destinationStr) {
    return apiError(
      res,
      400,
      "VALIDATION_ERROR",
      "origin and destination must be non-empty strings."
    );
  }

  // Helper to determine which error to return if multiple resolutions fail
  function pickWorstError(a, b) {
    const priority = [
      resolveErrorType.UPSTREAM_UNAVAILABLE,
      resolveErrorType.UPSTREAM_BAD_RESPONSE,
      resolveErrorType.NOT_FOUND,
      resolveErrorType.INTERNAL_ERROR,
      resolveErrorType.NONE,
    ];
    return (
      priority.find((t) => a === t || b === t) || resolveErrorType.INTERNAL_ERROR
    );
  }

  // Map internal resolution error types to API error responses
  function mapResolveError(errorType) {
    switch (errorType) {
      case resolveErrorType.NOT_FOUND:
        return {
          status: 404,
          code: "NOT_FOUND",
          message: "Could not resolve one or more locations to an airport code.",
        };
      case resolveErrorType.UPSTREAM_UNAVAILABLE:
        return {
          status: 503,
          code: "UPSTREAM_UNAVAILABLE",
          message: "Airport resolver temporarily unavailable.",
        };
      case resolveErrorType.UPSTREAM_BAD_RESPONSE:
        return {
          status: 502,
          code: "UPSTREAM_BAD_RESPONSE",
          message: "Airport resolver returned an unusable response.",
        };
      case resolveErrorType.INTERNAL_ERROR:
      default:
        return {
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Failed to resolve airports.",
        };
    }
  }

  try {
    const [originOut, destinationOut, compareOut] = await Promise.all([
        resolveToIATA(originStr),
        resolveToIATA(destinationStr),
        compareStr 
        ? resolveToIATA(compareStr) 
        : Promise.resolve({ result: null, errorType: resolveErrorType.NONE }),
      ])
    ;
    
    const worst = pickWorstError(
      originOut.errorType,
      destinationOut.errorType
    );

    if (worst !== resolveErrorType.NONE) {
      const mapped = mapResolveError(worst);
      return apiError(
        res,
        mapped.status,
        mapped.code,
        mapped.message, {
          originErrorType: originOut.errorType,
          destinationErrorType: destinationOut.errorType,
        }
      );
    }

    res.json({
      origin: originOut.result,
      destination: destinationOut.result,
      compare: compareOut.result,
    });
  } catch (err) {
    console.error("resolve-airports unexpected error:", err);
    return apiError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to resolve airports."
    );
  }
});

// Global error handler (catches unhandled errors from routes)
app.use((err, req, res, next) => {
  console.error("UNHANDLED_ERROR:", err); // log internal details
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Backend Imagen server running at http://localhost:${PORT}`);
});

