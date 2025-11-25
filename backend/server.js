import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { GoogleAuth } from "google-auth-library";
import fetch from "node-fetch";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Debugging log to confirm API key is loaded
console.log("BACKEND API KEY:", GOOGLE_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const PROJECT_ID = "holiday-planner-app-2";

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

app.listen(8080, () => {
    console.log("Backend Imagen server running at http://localhost:8080");
});

