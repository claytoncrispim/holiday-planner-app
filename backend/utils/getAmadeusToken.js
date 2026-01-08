// Function to get Amadeus access token
async function getAmadeusToken() {

    // --- AMADEUS config ---
    const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY;
    const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET;

    let amadeusToken = null;
    let amadeusTokenExpiresAt = 0; // epoch time in ms

    if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
        throw new Error("Amadeus API key/secret are not configured");
    }

    const now = Date.now();

    // Re-use token if it's still valid (with 60s safety margin)
    if (amadeusToken && now < amadeusTokenExpiresAt - 60_000) {
        return amadeusToken;
    }

    const tokenRes = await fetch(
        "https://test.api.amadeus.com/v1/security/oauth2/token",
        {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: AMADEUS_API_KEY,
            client_secret: AMADEUS_API_SECRET,
        }),
        }
    );
    
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
        console.error("Amadeus token error:", tokenData);
        throw new Error("Failed to get Amadeus access token");
    }
    
    amadeusToken = tokenData.access_token;
    amadeusTokenExpiresAt = now + (tokenData.expires_in * 1000);

    return amadeusToken;
}

export default getAmadeusToken;