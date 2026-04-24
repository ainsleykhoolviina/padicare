import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function wmoToCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly Clear";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([71, 73, 75].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain Showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Cloudy";
}

router.get("/weather", requireAuth, async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const locationName = (req.query.location as string) || "Unknown Location";

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "Valid lat and lng query params are required." });
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat.toString());
    url.searchParams.set("longitude", lng.toString());
    url.searchParams.set("current", [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
    ].join(","));
    url.searchParams.set("daily", [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
    ].join(","));
    url.searchParams.set("timezone", "Asia/Kuala_Lumpur");
    url.searchParams.set("forecast_days", "7");

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Weather service error: ${response.status}`);

    const data = await response.json() as any;
    const current = data.current;
    const daily = data.daily;

    const temperature = Math.round(current.temperature_2m);
    const humidity = Math.round(current.relative_humidity_2m);
    const rainfall = Math.round(current.precipitation * 10) / 10;
    const windSpeed = Math.round(current.wind_speed_10m);
    const condition = wmoToCondition(current.weather_code);

    const warnings: any[] = [];
    if (rainfall > 20) warnings.push({ type: "flood", severity: "high", messageMs: "Hujan lebat dijangka. Risiko banjir tinggi.", messageEn: "Heavy rainfall expected. High flood risk." });
    if (humidity > 85) warnings.push({ type: "pest", severity: "medium", messageMs: "Kelembapan tinggi meningkatkan risiko penyakit kulat.", messageEn: "High humidity increases fungal disease risk." });
    if (temperature > 35) warnings.push({ type: "heat", severity: "medium", messageMs: "Suhu tinggi. Pastikan pengairan mencukupi.", messageEn: "High temperature. Ensure adequate irrigation." });

    const forecast = (daily.time as string[]).map((date: string, i: number) => ({
      date,
      condition: wmoToCondition(daily.weather_code[i]),
      temperatureMax: Math.round(daily.temperature_2m_max[i]),
      temperatureMin: Math.round(daily.temperature_2m_min[i]),
      rainfall: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
    }));

    return res.json({
      location: locationName,
      latitude: lat,
      longitude: lng,
      temperature,
      humidity,
      rainfall,
      windSpeed,
      condition,
      warnings,
      forecast,
      updatedAt: new Date().toISOString(),
      source: "PadiCare Weather",
    });
  } catch (error) {
    console.error("Weather fetch error:", error);
    return res.status(500).json({ error: "Failed to fetch weather data." });
  }
});

export default router;
