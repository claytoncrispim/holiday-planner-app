import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";
import resolveToIATA from "./utils/resolveToIATA.js";
import getAmadeusToken from "./utils/getAmadeusToken.js";
import fetchWeatherForecast from "./utils/fetchWeatherForecast.js";

// Load config from .env
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PORT = process.env.PORT || 8080;

// Debugging log to confirm API key is loaded
console.log("BACKEND API KEY:", GOOGLE_API_KEY);

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
app.get("/real-flights", async (req, res) => {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    adults = "1",
  } = req.query;

  if (!origin || !destination || !departureDate) {
    return res.status(400).json({
      error: "Missing required query parameters. Need origin, destination, and departureDate.",
    });
  }

  try {
    const token = await getAmadeusToken();

    const params = new URLSearchParams({
      originLocationCode: origin,
      destinationLocationCode: destination,
      departureDate,
      adults: String(adults),
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

    if (!amadeusRes.ok) {
      console.error("Amadeus search error:", amadeusData);
      return res.status(500).json({
        error: "Failed to fetch flight offers from Amadeus",
        details: amadeusData,
      });
    }
      
    // Map Amadeus structure: simplified objects that the UI can handle
    const offers = 
      amadeusData.data?.map((offer, idx) => {
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
    return res
      .status(500)
      .json({ 
        error: "Internal error searching real flights" 
      });
  }
});

// --- Airport resolution API ---
// GET /resolve-airports?origin=...&destination=...&compare=...
app.get("/resolve-airports", async (req, res) => {
  const { origin, destination, compare } = req.query;

  try {
    const [originResolved, destinationResolved, compareResolved] =
      await Promise.all([
        resolveToIATA(origin),
        resolveToIATA(destination),
        compare ? resolveToIATA(compare) : Promise.resolve(null),
      ]);

    res.json({
      origin: originResolved,
      destination: destinationResolved,
      compare: compareResolved,
    });
  } catch (err) {
    console.error("resolve-airports error:", err);
    res
      .status(500)
      .json({ error: "Failed to resolve airports", details: err.toString() });
  }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Backend Imagen server running at http://localhost:${PORT}`);
});

