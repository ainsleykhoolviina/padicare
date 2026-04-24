import { useParams, useLocation, Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFarm } from "@/services/firestoreService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Edit, Droplets, CloudRain } from "lucide-react";
import FarmMapOverlay from "@/components/FarmMapOverlay";
const phaseOrder = ["nursery", "vegetative", "reproductive", "ripening", "harvested"];
const phaseColors: Record<string, string> = { nursery: "bg-blue-100 text-blue-700", vegetative: "bg-green-100 text-green-700", reproductive: "bg-amber-100 text-amber-700", ripening: "bg-orange-100 text-orange-700", harvested: "bg-gray-100 text-gray-700" };

export default function FarmDetailPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const params = useParams<{ farmId: string }>();
  const [, setLocation] = useLocation();
  const { data: farm, isLoading } = useFarm(user?.id, params.farmId);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!farm) return <div className="text-center py-12 text-muted-foreground">{t("noData")}</div>;

  const progress = ((phaseOrder.indexOf(farm.growthPhase) + 1) / phaseOrder.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => setLocation("/farms")} data-testid="button-back"><ArrowLeft className="w-5 h-5" /></Button><h1 className="text-xl font-bold text-foreground">{farm.name}</h1></div><Link href={`/farms/${farm.id}/edit`}><Button size="sm" variant="outline" className="gap-2" data-testid="button-edit-farm"><Edit className="w-4 h-4" />{t("edit")}</Button></Link></div>
      <Card className="float-hover"><CardContent className="pt-4 space-y-4"><div className="flex items-start justify-between"><div><div className="flex items-center gap-1 text-muted-foreground text-sm"><MapPin className="w-3.5 h-3.5" /><span>{farm.location}</span></div>{farm.latitude && farm.longitude && <p className="text-xs text-muted-foreground mt-0.5">{farm.latitude.toFixed(4)}, {farm.longitude.toFixed(4)}</p>}</div><Badge className={`${phaseColors[farm.growthPhase] || ""}`}>{t(farm.growthPhase as any)}</Badge></div><div><div className="flex items-center justify-between text-sm mb-2"><span className="text-muted-foreground">{lang === "ms" ? "Kemajuan Pertumbuhan" : "Growth Progress"}</span><span className="font-medium">{Math.round(progress)}%</span></div><div className="w-full bg-muted rounded-full h-3"><div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${progress}%` }} /></div><div className="flex justify-between mt-1">{phaseOrder.map((phase) => <span key={phase} className={`text-xs ${phase === farm.growthPhase ? "text-primary font-medium" : "text-muted-foreground"}`}>{t(phase as any)}</span>)}</div></div><div className="grid grid-cols-2 gap-4 pt-2"><Info label={t("paddyType")} value={farm.paddyType} /><Info label={t("farmSize")} value={sizeLabel(farm.farmSizeCategory, lang)} /><Info label={t("paddyAge")} value={`${farm.paddyAgeRange} ${lang === "ms" ? "hari" : "days"}`} /><Info label={lang === "ms" ? "Persekitaran" : "Environment"} value={farm.environment} /></div>{farm.notes && <div className="pt-2 border-t border-border"><p className="text-xs text-muted-foreground mb-1">{t("notes")}</p><p className="text-sm">{farm.notes}</p></div>}<div className="pt-2"><FarmMapOverlay farm={farm} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">{lang === "ms" ? "Cuaca Mock Ladang" : "Mock Farm Weather"}</CardTitle></CardHeader><CardContent><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-lg bg-muted p-3"><p className="text-xl font-bold">{farm.mockWeather.temperature}°C</p><p className="text-xs text-muted-foreground">{farm.mockWeather.condition}</p></div><div className="rounded-lg bg-muted p-3"><Droplets className="w-4 h-4 text-blue-500 mx-auto" /><p className="text-xl font-bold">{farm.mockWeather.humidity}%</p><p className="text-xs text-muted-foreground">{t("humidity")}</p></div><div className="rounded-lg bg-muted p-3"><CloudRain className="w-4 h-4 text-blue-600 mx-auto" /><p className="text-xl font-bold">{farm.mockWeather.rainfall}mm</p><p className="text-xs text-muted-foreground">{t("rainfall")}</p></div></div></CardContent></Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold">{value}</p></div>;
}

function sizeLabel(size: string, lang: string) {
  if (lang === "ms") return size === "small" ? "Kecil" : size === "medium" ? "Sederhana" : "Besar";
  return size === "small" ? "Small" : size === "medium" ? "Medium" : "Large";
}
