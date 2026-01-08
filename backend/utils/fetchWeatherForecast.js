import isNumber from "./isNumber.js";

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

export default fetchWeatherForecast;