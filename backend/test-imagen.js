import { GoogleAuth } from "google-auth-library";
import fs from "fs";

const PROJECT_ID = "holiday-planner-app-2"; // replace with your real project ID

async function generateImage(prompt) {
  const auth = new GoogleAuth({
    keyFile: "service-account.json", // path to your downloaded key 
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const response = await fetch(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/imagen-3.0-generate-002:predict`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
    }
  );

  const result = await response.json();

  if (result.error) {
    console.error("❌ Imagen API error:", result.error);
    return;
  }

  const base64 = result.predictions?.[0]?.bytesBase64Encoded;
  if (!base64) {
    console.error("❌ No image data returned");
    return;
  }

  const outputPath = "./output.png";
  fs.writeFileSync(outputPath, Buffer.from(base64, "base64"));
  console.log(`✅ Image saved to ${outputPath}`);
}

// Run it
generateImage("A tropical beach at sunset with palm trees");
