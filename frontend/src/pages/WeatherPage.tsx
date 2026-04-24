import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFarms } from "@/services/firestoreService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Droplets, CloudRain, Wind, AlertTriangle, Cloud, Sun, Zap, MapPin, RefreshCw, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Farm } from "@/lib/models";

// ─── Types ────────────────────────────────────────────────────────────────────

type ForecastDay = {
  date: string;
  condition: string;
  temperatureMax: number;
  temperatureMin: number;
  rainfall: number;
};

type WeatherData = {
  location: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  condition: string;
  warnings: { type: string; severity: string; messageMs: string; messageEn: string }[];
  forecast: ForecastDay[];
  updatedAt: string;
  source: string;
};

type FarmWeather = {
  farm: Farm;
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ConditionIcon = ({ condition, size = "md" }: { condition: string; size?: "sm" | "md" | "lg" }) => {
  const c = condition.toLowerCase();
  const cls = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-4 h-4" : "w-6 h-6";
  if (c.includes("thunder") || c.includes("storm")) return <Zap className={`${cls} text-yellow-500`} />;
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return <CloudRain className={`${cls} text-blue-500`} />;
  if (c.includes("cloud") || c.includes("overcast") || c.includes("fog")) return <Cloud className={`${cls} text-gray-400`} />;
  return <Sun className={`${cls} text-amber-400`} />;
};

const severityColor: Record<string, string> = {
  high: "border-red-300 bg-red-50 dark:bg-red-950/30",
  medium: "border-orange-300 bg-orange-50 dark:bg-orange-950/30",
  low: "border-amber-200 bg-amber-50 dark:bg-amber-950/30",
};
const severityIconColor: Record<string, string> = {
  high: "text-red-600",
  medium: "text-orange-600",
  low: "text-amber-600",
};
const severityBadge: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-orange-100 text-orange-800",
  low: "bg-amber-100 text-amber-800",
};

// ─── Hook: fetch real weather per farm ───────────────────────────────────────

function useFarmWeather(farm: Farm): { weather: WeatherData | null; isLoading: boolean; error: string | null; refetch: () => void } {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!farm.latitude || !farm.longitude) {
      setError("no-coords");
      return;
    }
    setIsLoading(true);
    setError(null);

    const lat = farm.latitude;
    const lng = farm.longitude;

    // Try backend first, fallback to Open-Meteo directly
    const fetchWeather = async () => {
      // Try backend
      try {
        const r = await fetch(`/api/weather?lat=${lat}&lng=${lng}&location=${encodeURIComponent(farm.location)}`);
        if (r.ok) {
          const data = await r.json();
          if (data && data.temperature !== undefined) {
            setWeather(data);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Backend unavailable, fall through
      }

      // Fallback: hit Open-Meteo directly from frontend
      try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", lat.toString());
        url.searchParams.set("longitude", lng.toString());
        url.searchParams.set("current", "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m");
        url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum");
        url.searchParams.set("timezone", "Asia/Kuala_Lumpur");
        url.searchParams.set("forecast_days", "7");

        const r = await fetch(url.toString());
        if (!r.ok) throw new Error("Weather service unavailable");
        const data = await r.json() as any;

        const wmo: Record<number, string> = {
          0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
          45: "Foggy", 48: "Foggy", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle",
          61: "Rain", 63: "Rain", 65: "Heavy Rain",
          80: "Rain Showers", 81: "Rain Showers", 82: "Heavy Rain Showers",
          95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
        };
        const toCondition = (code: number) => wmo[code] || "Cloudy";

        const cur = data.current;
        const daily = data.daily;
        const temperature = Math.round(cur.temperature_2m);
        const humidity = Math.round(cur.relative_humidity_2m);
        const rainfall = Math.round(cur.precipitation * 10) / 10;
        const windSpeed = Math.round(cur.wind_speed_10m);
        const condition = toCondition(cur.weather_code);

        const warnings: WeatherData["warnings"] = [];
        if (rainfall > 20) warnings.push({ type: "flood", severity: "high", messageMs: "Hujan lebat. Risiko banjir tinggi.", messageEn: "Heavy rain. High flood risk." });
        if (humidity > 85) warnings.push({ type: "pest", severity: "medium", messageMs: "Kelembapan tinggi — risiko kulat meningkat.", messageEn: "High humidity — fungal disease risk." });
        if (temperature > 35) warnings.push({ type: "heat", severity: "medium", messageMs: "Suhu tinggi. Pastikan pengairan mencukupi.", messageEn: "High temperature. Ensure adequate irrigation." });

        const forecast: ForecastDay[] = (daily.time as string[]).map((date: string, i: number) => ({
          date,
          condition: toCondition(daily.weather_code[i]),
          temperatureMax: Math.round(daily.temperature_2m_max[i]),
          temperatureMin: Math.round(daily.temperature_2m_min[i]),
          rainfall: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
        }));

        setWeather({ location: farm.location, latitude: lat, longitude: lng, temperature, humidity, rainfall, windSpeed, condition, warnings, forecast, updatedAt: new Date().toISOString(), source: "PadiCare Weather" } as any);
        setIsLoading(false);
      } catch (err) {
        setError("failed");
        setIsLoading(false);
      }
    };

    fetchWeather();
  }, [farm.id, farm.latitude, farm.longitude, tick]);

  return { weather, isLoading, error, refetch: () => setTick((t) => t + 1) };
}

// ─── Single Farm Weather Card ─────────────────────────────────────────────────

function FarmWeatherCard({ farm, lang }: { farm: Farm; lang: string }) {
  const { weather, isLoading, error, refetch } = useFarmWeather(farm);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">{farm.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{farm.location}
              </p>
            </div>
          </div>
          <p className="text-xs text-destructive mt-3">
            {error === "no-coords"
              ? (lang === "ms" ? "Koordinat ladang belum ditetapkan. Edit ladang untuk tambah lokasi." : "Farm coordinates not set. Edit farm to add location.")
              : (lang === "ms" ? "Gagal memuatkan cuaca." : "Failed to load weather.")}
          </p>
          {error !== "no-coords" && (
            <Button variant="ghost" size="sm" className="mt-2 gap-1 text-xs" onClick={refetch}>
              <RefreshCw className="w-3 h-3" /> {lang === "ms" ? "Cuba lagi" : "Retry"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Main weather info */}
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{farm.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />{farm.location}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={refetch} title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Temperature + condition */}
        <div className="flex items-center justify-between">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold">{weather.temperature}°C</span>
            <span className="text-sm text-muted-foreground mb-1">{weather.condition}</span>
          </div>
          <ConditionIcon condition={weather.condition} size="lg" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
          <div className="flex flex-col items-center gap-0.5">
            <Droplets className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold">{weather.humidity}%</p>
            <p className="text-xs text-muted-foreground">{lang === "ms" ? "Lembap" : "Humidity"}</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <CloudRain className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold">{weather.rainfall}mm</p>
            <p className="text-xs text-muted-foreground">{lang === "ms" ? "Hujan" : "Rainfall"}</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Wind className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold">{weather.windSpeed}</p>
            <p className="text-xs text-muted-foreground">km/h</p>
          </div>
        </div>

        {/* Warnings */}
        {weather.warnings.length > 0 && (
          <div className="mt-3 space-y-2">
            {weather.warnings.map((w, i) => (
              <Alert key={i} className={`border py-2 ${severityColor[w.severity] || severityColor.low}`}>
                <AlertTriangle className={`w-3.5 h-3.5 ${severityIconColor[w.severity] || "text-amber-600"}`} />
                <AlertDescription className="text-xs ml-1">
                  <span className={`inline-flex items-center gap-1 font-medium`}>
                    <Badge className={`text-xs px-1.5 py-0 ${severityBadge[w.severity]}`}>{w.severity}</Badge>
                    {lang === "ms" ? w.messageMs : w.messageEn}
                  </span>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Toggle forecast */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-muted-foreground"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded
            ? (lang === "ms" ? "Sembunyikan ramalan" : "Hide forecast")
            : (lang === "ms" ? "Lihat ramalan 7 hari" : "Show 7-day forecast")}
        </Button>
      </CardContent>

      {/* 7-day forecast */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="grid grid-cols-7 gap-1">
            {weather.forecast.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted transition-colors">
                <p className="text-xs text-muted-foreground font-medium">
                  {i === 0
                    ? (lang === "ms" ? "Hari ini" : "Today")
                    : new Date(day.date).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", { weekday: "short" })}
                </p>
                <ConditionIcon condition={day.condition} size="sm" />
                <p className="text-xs font-bold">{day.temperatureMax}°</p>
                <p className="text-xs text-muted-foreground">{day.temperatureMin}°</p>
                {day.rainfall > 0 && (
                  <p className="text-xs text-blue-500">{day.rainfall}mm</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right mt-2">
            {lang === "ms" ? "Dikemaskini: " : "Updated: "}
            {new Date(weather.updatedAt).toLocaleTimeString(lang === "ms" ? "ms-MY" : "en-MY", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WeatherPage() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { data: farms, isLoading: farmsLoading } = useFarms(user?.id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {lang === "ms" ? "Cuaca Ladang" : "Farm Weather"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lang === "ms"
            ? "Cuaca masa nyata untuk setiap ladang anda"
            : "Real-time weather for each of your farms"}
        </p>
      </div>

      {farmsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : farms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Thermometer className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">
              {lang === "ms" ? "Tiada ladang didaftarkan" : "No farms registered"}
            </p>
            <p className="text-sm mt-1">
              {lang === "ms"
                ? "Tambah ladang untuk melihat cuaca masa nyata"
                : "Add a farm to see real-time weather"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {farms.map((farm) => (
            <FarmWeatherCard key={farm.id} farm={farm} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}
