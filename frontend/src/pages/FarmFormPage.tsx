import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { inferGrowthPhase, saveFarm, useFarm } from "@/services/firestoreService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Search, Loader2, Navigation } from "lucide-react";
import VoiceInput from "@/components/VoiceInput";
import type { FarmSizeCategory, PaddyAgeRange } from "@/lib/models";

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// @ts-ignore
import icon from "leaflet/dist/images/marker-icon.png";
// @ts-ignore
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const schema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  environment: z.string().min(1),
  paddyType: z.string().min(1),
  farmSizeCategory: z.enum(["small", "medium", "large"]),
  paddyAgeRange: z.enum(["0-30", "31-60", "61-90"]),
  notes: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

type Suggestion = {
  formatted: string;
  geometry: { lat: number; lng: number };
  components: {
    _type?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

const PADDY_TYPES = ["MR219", "MR220", "MR263", "MR284", "MR297", "Basmati", "Jasmine", "other"];
const DEFAULT_CENTER: [number, number] = [3.139, 101.6869];

/** Derive a descriptive, varied environment string from coordinates + address */
function deriveEnvironment(
  lat: number,
  lng: number,
  address: { state?: string; city?: string; village?: string; suburb?: string; country?: string }
): string {
  const absLat = Math.abs(lat);

  // --- climate ---
  let climate: string;
  if (absLat <= 10) climate = "Humid equatorial";
  else if (absLat <= 15) climate = "Tropical wet";
  else if (absLat <= 23.5) climate = "Tropical monsoon";
  else if (absLat <= 30) climate = "Subtropical humid";
  else if (absLat <= 40) climate = "Warm temperate";
  else climate = "Cool temperate";

  // --- terrain hint from known regions ---
  const state = (address.state || "").toLowerCase();
  const city = (address.city || "").toLowerCase();
  const village = (address.village || "").toLowerCase();
  const country = (address.country || "").toLowerCase();
  const all = `${state} ${city} ${village} ${country}`;

  let terrain = "lowland";
  const highland = ["cameron", "kundasang", "ranau", "dieng", "bandung", "lembang", "brastagi", "dalat", "sapa", "baguio", "chiang mai", "chiang rai"];
  const coastal = ["pantai", "kuala", "port", "tanjung", "coastal", "pesisir", "beach", "teluk", "pulau", "island"];
  const delta = ["delta", "mekong", "irrawaddy", "ganges", "chao phraya"];
  const valley = ["valley", "lembah", "ngarai"];

  if (highland.some((k) => all.includes(k))) terrain = "highland";
  else if (delta.some((k) => all.includes(k))) terrain = "river delta";
  else if (valley.some((k) => all.includes(k))) terrain = "valley";
  else if (coastal.some((k) => all.includes(k))) terrain = "coastal lowland";

  // --- soil / water hint ---
  let soilHint: string;
  if (terrain === "river delta") soilHint = "alluvial soil, high water table";
  else if (terrain === "coastal lowland") soilHint = "saline-prone clay soil";
  else if (terrain === "highland") soilHint = "laterite soil, cooler microclimate";
  else if (terrain === "valley") soilHint = "fertile valley floor, good drainage";
  else soilHint = "clay-loam paddy soil";

  // --- regional label ---
  const regionParts: string[] = [];
  if (address.state) regionParts.push(address.state);
  if (address.country) regionParts.push(address.country);
  const region = regionParts.join(", ");

  // --- rainfall pattern ---
  let rainfall: string;
  if (lng >= 95 && lng <= 120 && absLat <= 10) rainfall = "year-round rainfall";
  else if (absLat <= 23.5) rainfall = "seasonal monsoon rainfall";
  else rainfall = "moderate seasonal rainfall";

  return `${climate} ${terrain} — ${soilHint}, ${rainfall}${region ? ` (${region})` : ""}`;
}

function getShortLabel(s: Suggestion): string {
  const c = s.components;
  const parts = [c.road, c.suburb, c.city || c.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : s.formatted;
}

function getSecondaryLabel(s: Suggestion): string {
  const c = s.components;
  return [c.city || c.suburb, c.state, c.country].filter(Boolean).join(", ");
}

function getPlaceIcon(s: Suggestion): string {
  const type = s.components._type || "";
  if (["road", "street", "path"].includes(type)) return "🛣️";
  if (["village", "town", "city", "municipality"].includes(type)) return "🏙️";
  if (["farm", "farmland", "agricultural"].includes(type)) return "🌾";
  if (["neighbourhood", "suburb", "quarter"].includes(type)) return "📍";
  if (["state", "county", "region"].includes(type)) return "🗺️";
  return "📍";
}

// This component lives INSIDE MapContainer so it can call useMap()
// It watches the mapCenter prop and flies the map there whenever it changes
function FlyToLocation({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { animate: true, duration: 1 });
    }
  }, [center, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function FarmFormPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const params = useParams<{ farmId?: string }>();
  const isEdit = Boolean(params.farmId);
  const [, setLocation] = useLocation();

  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [customPaddyType, setCustomPaddyType] = useState("");

  // mapCenter is the source of truth for the map position — separate from form values
  // so the map always flies to the right place immediately
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: existingFarm, isLoading: loadingFarm } = useFarm(user?.id, params.farmId);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      location: "",
      latitude: null,
      longitude: null,
      environment: "",
      paddyType: "MR219",
      farmSizeCategory: "small",
      paddyAgeRange: "0-30",
      notes: "",
    },
  });

  // Load existing farm data when editing
  useEffect(() => {
    if (existingFarm && isEdit) {
      const isKnownType = PADDY_TYPES.includes(existingFarm.paddyType);
      form.reset({
        name: existingFarm.name,
        location: existingFarm.location,
        latitude: existingFarm.latitude,
        longitude: existingFarm.longitude,
        environment: existingFarm.environment,
        paddyType: isKnownType ? existingFarm.paddyType : "other",
        farmSizeCategory: existingFarm.farmSizeCategory,
        paddyAgeRange: existingFarm.paddyAgeRange,
        notes: existingFarm.notes,
      });
      if (!isKnownType) setCustomPaddyType(existingFarm.paddyType);
      setSearchInput(existingFarm.location);
      if (existingFarm.latitude && existingFarm.longitude) {
        const pos: [number, number] = [existingFarm.latitude, existingFarm.longitude];
        setMapCenter(pos);
        setMarkerPos(pos);
      }
    }
  }, [existingFarm, isEdit, form]);

  // Set a new pin location — updates form, map, and marker all at once
  const setPin = useCallback((lat: number, lng: number) => {
    const pos: [number, number] = [lat, lng];
    form.setValue("latitude", lat);
    form.setValue("longitude", lng);
    setMarkerPos(pos);
    setMapCenter(pos); // This triggers FlyToLocation inside the map
  }, [form]);

  // Reverse geocode: coordinates → readable place name
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    // Clear the box immediately so user knows it's updating
    setSearchInput("");
    form.setValue("location", "");
    try {
      const res = await fetch(`/api/maps/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.results?.length > 0) {
        const c = data.results[0].components || {};
        const parts = [
          c.road || c.pedestrian || c.footway,
          c.suburb || c.neighbourhood || c.quarter,
          c.city || c.town || c.village || c.county,
          c.state,
        ].filter(Boolean);
        const readable = parts.length >= 2 ? parts.join(", ") : data.results[0].formatted;
        form.setValue("location", readable);
        setSearchInput(readable);
        form.setValue("environment", deriveEnvironment(lat, lng, {
          state: c.state, city: c.city || c.town, village: c.village, suburb: c.suburb, country: c.country,
        }));
        return;
      }
    } catch (err) {
      console.error("Reverse geocode via backend failed, trying Nominatim fallback:", err);
    }
    // Fallback: use OpenStreetMap Nominatim directly (no API key needed)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        {
          headers: {
            "Accept-Language": "ms,en",
            "User-Agent": "PadiCare-App/1.0",
          },
        }
      );
      const data = await res.json();
      if (data.display_name) {
        const a = data.address || {};
        const parts = [
          a.road || a.pedestrian,
          a.suburb || a.neighbourhood || a.village,
          a.city || a.town || a.county,
          a.state,
        ].filter(Boolean);
        const readable = parts.length >= 2 ? parts.join(", ") : data.display_name.split(",").slice(0, 3).join(",").trim();
        form.setValue("location", readable);
        setSearchInput(readable);
        form.setValue("environment", deriveEnvironment(lat, lng, {
          state: a.state, city: a.city || a.town, village: a.village, suburb: a.suburb, country: a.country,
        }));
      }
    } catch (err2) {
      console.error("Nominatim fallback also failed:", err2);
    } finally {
      setIsReverseGeocoding(false);
    }
    setIsReverseGeocoding(false);
  }, [form]);

  // Search suggestions
  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/maps/geocode?address=${encodeURIComponent(query)}`);
      const data = await res.json();
      const results: Suggestion[] = data.results || [];
      if (results.length > 0) {
        setSuggestions(results);
        setShowSuggestions(true);
        return;
      }
    } catch {
      // Backend unavailable, fall through to Nominatim
    }
    // Fallback: Nominatim search (no API key needed)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=my,id`,
        {
          headers: {
            "Accept-Language": "ms,en",
            "User-Agent": "PadiCare-App/1.0",
          },
        }
      );
      const data = await res.json();
      const results: Suggestion[] = (data || []).map((item: any) => ({
        formatted: item.display_name,
        geometry: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
        components: {
          _type: item.type,
          road: item.address?.road || item.address?.pedestrian,
          suburb: item.address?.suburb || item.address?.neighbourhood,
          city: item.address?.city || item.address?.town || item.address?.village,
          state: item.address?.state,
          country: item.address?.country,
        },
      }));
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
    setIsSearching(false);
  };

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    form.setValue("location", value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 700);
  };

  // User picks a suggestion from dropdown
  const handleSuggestionSelect = (s: Suggestion) => {
    const { lat, lng } = s.geometry;
    setPin(lat, lng);
    form.setValue("location", s.formatted);
    setSearchInput(s.formatted);
    form.setValue("environment", deriveEnvironment(lat, lng, {
      state: s.components.state, city: s.components.city, suburb: s.components.suburb, country: s.components.country,
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Enter key: pick first suggestion, don't submit form
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) handleSuggestionSelect(suggestions[0]);
    }
    if (e.key === "Escape") setShowSuggestions(false);
  };

  // GPS detect my location
  const detectLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      setError(lang === "ms" ? "Geolokasi tidak disokong." : "Geolocation not supported.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setPin(latitude, longitude);       // Move map + marker immediately
        reverseGeocode(latitude, longitude); // Then fetch place name
        setIsLocating(false);
      },
      () => {
        setError(lang === "ms" ? "Gagal mengesan lokasi." : "Could not detect location.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Click on map
  const onMapClick = (lat: number, lng: number) => {
    setPin(lat, lng);
    reverseGeocode(lat, lng);
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setError("");
    setIsPending(true);
    try {
      const finalPaddyType = data.paddyType === "other" && customPaddyType.trim()
        ? customPaddyType.trim()
        : data.paddyType;
      await saveFarm(user.id, {
        ...data,
        paddyType: finalPaddyType,
        id: params.farmId,
        growthPhase: inferGrowthPhase(data.paddyAgeRange),
        notes: data.notes || null,
      });
      setLocation("/farms");
    } catch {
      setError(lang === "ms" ? "Ralat menyimpan data." : "Error saving data.");
    } finally {
      setIsPending(false);
    }
  };

  if (isEdit && loadingFarm)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/farms")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? t("editFarm") : t("addNewFarm")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{lang === "ms" ? "Maklumat Ladang" : "Farm Information"}</CardTitle>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {/* Farm Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t("farmName")}</Label>
              <div className="flex gap-2">
                <Input id="name" {...form.register("name")} className="flex-1" data-testid="input-farm-name" />
                <VoiceInput onResult={(text) => form.setValue("name", text)} />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {t("location")}
                </div>
              </Label>

              <div className="flex gap-2 items-start">
                {/* Search box */}
                <div className="flex-1 relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder={lang === "ms" ? "Cari alamat, nama jalan, kawasan..." : "Search address, street, area..."}
                      className="pl-9 pr-9"
                      value={searchInput}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                      autoComplete="off"
                      data-testid="input-location-search"
                    />
                    {(isSearching || isReverseGeocoding) && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Dropdown suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[1000] mt-1 bg-card border rounded-xl shadow-xl overflow-hidden">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-0 flex items-start gap-3"
                          onClick={() => handleSuggestionSelect(s)}
                        >
                          <span className="text-lg mt-0.5 shrink-0">{getPlaceIcon(s)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{getShortLabel(s)}</p>
                            <p className="text-xs text-muted-foreground truncate">{getSecondaryLabel(s)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {showSuggestions && (
                    <div className="fixed inset-0 z-[999]" onClick={() => setShowSuggestions(false)} />
                  )}
                </div>

                {/* My Location button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={detectLocation}
                  disabled={isLocating}
                  className="gap-2 shrink-0"
                >
                  {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  <span className="hidden sm:inline">
                    {isLocating ? t("loading") : lang === "ms" ? "Lokasi Saya" : "My Location"}
                  </span>
                </Button>
              </div>

              <input type="hidden" {...form.register("latitude", { valueAsNumber: true })} />
              <input type="hidden" {...form.register("longitude", { valueAsNumber: true })} />
            </div>

            {/* Map — single MapContainer, never remounted */}
            <div className="border rounded-xl overflow-hidden relative z-0" style={{ height: 380 }}>
              <MapContainer
                center={markerPos ?? DEFAULT_CENTER}
                zoom={markerPos ? 15 : 6}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* FlyToLocation watches mapCenter and smoothly flies the map there */}
                <FlyToLocation center={mapCenter} />
                <MapClickHandler onClick={onMapClick} />
                {markerPos && (
                  <Marker
                    position={markerPos}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const pos = e.target.getLatLng();
                        setPin(pos.lat, pos.lng);
                        reverseGeocode(pos.lat, pos.lng);
                      },
                    }}
                  />
                )}
              </MapContainer>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
                <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  {lang === "ms" ? "Klik peta atau seret pin untuk pilih lokasi" : "Click map or drag pin to set location"}
                </span>
              </div>
            </div>

            {/* Environment — auto-filled from location */}
            <div className="space-y-2">
              <Label>{lang === "ms" ? "Persekitaran" : "Environment"}</Label>
              <Input {...form.register("environment")} readOnly className="bg-muted cursor-default" data-testid="input-environment" />
              <p className="text-xs text-muted-foreground">{lang === "ms" ? "Auto berdasarkan lokasi" : "Auto-filled based on location"}</p>
            </div>

            {/* Paddy Type & Farm Size */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("paddyType")}</Label>
                <Select onValueChange={(v) => { form.setValue("paddyType", v); if (v !== "other") setCustomPaddyType(""); }} defaultValue={form.getValues("paddyType")}>
                  <SelectTrigger data-testid="select-paddy-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PADDY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type === "other" ? t("other") : type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.watch("paddyType") === "other" && (
                  <Input
                    placeholder={lang === "ms" ? "Masukkan jenis padi..." : "Enter paddy type..."}
                    value={customPaddyType}
                    onChange={(e) => setCustomPaddyType(e.target.value)}
                    data-testid="input-custom-paddy-type"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("farmSize")}</Label>
                <Select onValueChange={(v) => form.setValue("farmSizeCategory", v as FarmSizeCategory)} defaultValue={form.getValues("farmSizeCategory")}>
                  <SelectTrigger data-testid="select-farm-size"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">{lang === "ms" ? "Kecil" : "Small"}</SelectItem>
                    <SelectItem value="medium">{lang === "ms" ? "Sederhana" : "Medium"}</SelectItem>
                    <SelectItem value="large">{lang === "ms" ? "Besar" : "Large"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Paddy Age */}
            <div className="space-y-2">
              <Label>{t("paddyAge")}</Label>
              <Select onValueChange={(v) => form.setValue("paddyAgeRange", v as PaddyAgeRange)} defaultValue={form.getValues("paddyAgeRange")}>
                <SelectTrigger data-testid="select-paddy-age"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-30">0–30 {lang === "ms" ? "hari" : "days"}</SelectItem>
                  <SelectItem value="31-60">31–60 {lang === "ms" ? "hari" : "days"}</SelectItem>
                  <SelectItem value="61-90">61–90 {lang === "ms" ? "hari" : "days"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <div className="flex gap-2">
                <Textarea id="notes" {...form.register("notes")} rows={3} className="flex-1" data-testid="textarea-notes" />
                <VoiceInput onResult={(text) => form.setValue("notes", text)} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setLocation("/farms")} data-testid="button-cancel">
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={isPending} className="flex-1" data-testid="button-save-farm">
                {isPending ? t("loading") : isEdit ? t("save") : t("addFarm")}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
