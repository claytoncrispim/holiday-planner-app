import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PORT = process.env.PORT || 8080;

// Debugging log to confirm API key is loaded
console.log("BACKEND API KEY:", GOOGLE_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const PROJECT_ID = "holiday-planner-app-2";

// --- WEATHER HELPERS (Open-Meteo) ---

// Number checker
const isNumber = (n) => typeof n === "number" && !isNaN(n);

async function fetchWeatherForecast(cityName) {
  if (!cityName) {
    throw new Error("DESTINATION_REQUIRED");
  }

  // 1. Geocode the city name to get latitude and longitude
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cityName
  )}&count=1&language=en&format=json`;

  const geoRes = await fetch(geoUrl);
  if (!geoRes.ok) {
    throw new Error(`GEOCODING_FAILED${geoRes.status || "UNKNOWN_STATUS"}`
    );
  }

  const geoData = await geoRes.json();
  const place = geoData.results?.[0];

  if (!place) {
    // No match found for the city
    return {
      found: false,
      message: `Could not find weather location for "${cityName}".`,
    };
  }

  const {
    latitude,
    longitude,
    name,
    country,
    timezone,
  } = place;

   // 2. Get a 7-day daily forecast for that location
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto` +
    `&forecast_days=7`;

  const forecastRes = await fetch(forecastUrl);
  if (!forecastRes.ok) {
    throw new Error(
      `FORECAST_FAILED${forecastRes.status || "UNKNOWN_STATUS"}`
    );
  }

  const forecastData = await forecastRes.json();
  const daily = forecastData.daily;

  if (
    !daily ||
    !Array.isArray(daily.time) ||
    !Array.isArray(daily.temperature_2m_max)
  ) {
    throw new Error("FORECAST_UNEXPECTED_SHAPE");
  }

  // 3. Build a small, friendly summary object
  const days = daily.time.map((date, idx) => ({
    date,
    tempMax: daily.temperature_2m_max[idx],
    tempMin: daily.temperature_2m_min[idx],
    precipitationSum: daily.precipitation_sum[idx],
  }));

  // Compute some simple stats for a headline
  let sumMax = 0;
  let sumMin = 0;
  let sumRain = 0;
  let count = 0;

  for (const d of days) {
    if (isNumber(d.tempMax) && isNumber(d.tempMin)) {
      sumMax += d.tempMax;
      sumMin += d.tempMin;
      count+= 1;
    }
    if (isNumber(d.precipitationSum)) {
      sumRain += d.precipitationSum;
    }
  }

  const avgMax = count > 0 ? sumMax / count : null;
  const avgMin = count > 0 ? sumMin / count : null;

  // Tiny heuristic for a 1-line description
  let headline = "Mixed conditions";

  if (avgMax !== null && avgMin !== null) {
    if (avgMax >= 25 && sumRain < 5) {
      headline = "Warm and mostly dry – great beach or pool weather.";
    } else if (avgMax >= 20 && sumRain < 10) {
      headline = "Mild and generally pleasant with only light rain.";
    } else if (avgMax < 10) {
      headline = "Chilly overall – pack layers and a warm jacket.";
    } else if (sumRain >= 15) {
      headline = "Expect a fair bit of rain – an umbrella is a good idea.";
    }
  }

  return {
    found: true,
    provider: "Open-Meteo",
    location: {
      name,
      country,
      latitude,
      longitude,
      timezone,
    },
    summary: {
      headline,
      avgMax,
      avgMin,
      totalPrecipitation: sumRain,
    },
    daily: days,
  };
}

// --- GOOGLE API ROUTES ---
// Endpoint to generate image using Google Imagen API
app.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;

  try {
    const auth = new GoogleAuth({
        keyFile: "./service-account.json",
        scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
  
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
                parameters: { sampleCount: 1},
            }),
        }
    );

    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: err.toString() });
  }
});
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

// Start the server
app.listen(PORT, () => {
    console.log(`Backend Imagen server running at ${PORT}`);
});

