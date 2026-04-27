import type { MockWeather } from "@/lib/models";

const conditions = ["Partly cloudy", "Light rain", "Humid", "Sunny", "Evening showers"];

export function generateMockWeather(latitude?: number | null, longitude?: number | null): MockWeather {
  const seed = Math.abs(Math.round(((latitude ?? 3.139) * 1000) + ((longitude ?? 101.6869) * 1000)));
  return {
    temperature: 28 + (seed % 6),
    humidity: 72 + (seed % 18),
    rainfall: seed % 24,
    windSpeed: 5 + (seed % 11),
    condition: conditions[seed % conditions.length],
    updatedAt: new Date().toISOString(),
  };
}

// random function

export function weatherWarnings(weather: MockWeather) {
  const warnings = [];
  if (weather.humidity >= 85) {
    warnings.push({
      type: "humidity",
      severity: "medium",
      messageMs: "Kelembapan tinggi boleh meningkatkan risiko penyakit daun. Pantau sawah dengan lebih kerap.",
      messageEn: "High humidity may increase leaf disease risk. Monitor the field more often.",
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  if (weather.rainfall >= 18) {
    warnings.push({
      type: "rainfall",
      severity: "high",
      messageMs: "Hujan lebat dijangka. Periksa paras air dan saliran sawah.",
      messageEn: "Heavy rain is expected. Check water level and field drainage.",
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return warnings;
}
