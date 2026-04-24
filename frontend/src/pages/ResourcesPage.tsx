import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchDynamicWeeklyPlan,
  fetchResourceInsights,
  saveTaskPlan,
  useDiseaseDetections,
  useFarms,
  useTaskPlans,
  type RecentDiseaseRef,
} from "@/services/firestoreService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart3, Sprout, Droplets, Calendar, CheckCircle,
  ShieldAlert, AlertTriangle, Sparkles, Loader2, Bug,
  Thermometer, Wind, CloudRain, RefreshCw,
} from "lucide-react";
import type { WeeklyTaskPlan } from "@/lib/models";

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

const categoryMeta: Record<string, { label: { ms: string; en: string }; icon: React.ReactNode; color: string }> = {
  fertilizer: {
    label: { ms: "Baja", en: "Fertilizer" },
    icon: <Sprout className="w-4 h-4 text-green-600" />,
    color: "border-green-200 bg-green-50/50",
  },
  pesticide: {
    label: { ms: "Racun Perosak", en: "Pesticide" },
    icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
    color: "border-amber-200 bg-amber-50/50",
  },
  irrigation: {
    label: { ms: "Pengurusan Air", en: "Water Management" },
    icon: <Droplets className="w-4 h-4 text-blue-600" />,
    color: "border-blue-200 bg-blue-50/50",
  },
  monitoring: {
    label: { ms: "Pemantauan", en: "Monitoring" },
    icon: <Calendar className="w-4 h-4 text-primary" />,
    color: "border-primary/20 bg-primary/5",
  },
  disease_follow_up: {
    label: { ms: "Susulan Penyakit", en: "Disease Follow-up" },
    icon: <Bug className="w-4 h-4 text-red-600" />,
    color: "border-red-200 bg-red-50/50",
  },
};

export default function ResourcesPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { data: farms } = useFarms(user?.id);
  const { data: existingPlans } = useTaskPlans(user?.id);
  const { data: detections } = useDiseaseDetections(user?.id);

  const [farmId, setFarmId] = useState("");
  const [plan, setPlan] = useState<WeeklyTaskPlan | null>(null);
  const [insight, setInsight] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedFarm = farms.find((f) => f.id === farmId);

  // Reset plan when farm changes
  useEffect(() => {
    setPlan(null);
    setInsight("");
    setError("");
  }, [farmId]);

  // Load AI insight whenever a farm is selected
  useEffect(() => {
    if (!selectedFarm) return;
    let cancelled = false;
    setIsInsightLoading(true);
    setInsight("");

    const farmPlans = existingPlans.filter((p) => p.farmId === selectedFarm.id);
    const pendingCount = farmPlans
      .flatMap((p) => p.tasks)
      .filter((t) => !t.completed).length;

    const recentDiseases: RecentDiseaseRef[] = detections
      .filter((d) => d.farmId === selectedFarm.id)
      .slice(0, 3)
      .map((d) => ({ diseaseNameEn: d.diseaseNameEn, severity: d.severity, detectedAt: d.detectedAt }));

    fetchResourceInsights(selectedFarm, pendingCount, recentDiseases, lang)
      .then((text) => { if (!cancelled) setInsight(text); })
      .finally(() => { if (!cancelled) setIsInsightLoading(false); });

    return () => { cancelled = true; };
  }, [farmId, selectedFarm, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const onGenerate = async () => {
    if (!user || !selectedFarm) return;
    setIsPending(true);
    setError("");
    try {
      const recentDiseases: RecentDiseaseRef[] = detections
        .filter((d) => d.farmId === selectedFarm.id)
        .slice(0, 5)
        .map((d) => ({ diseaseNameEn: d.diseaseNameEn, severity: d.severity, detectedAt: d.detectedAt }));

      const generated = await fetchDynamicWeeklyPlan(selectedFarm, existingPlans, recentDiseases);
      const id = await saveTaskPlan(user.id, generated);
      setPlan({ ...generated, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to generate plan", err);
      setError(
        lang === "ms"
          ? "Gagal menjana pelan. Sila semak sambungan dan cuba lagi."
          : "Failed to generate plan. Please check your connection and try again.",
      );
    } finally {
      setIsPending(false);
    }
  };

  // Carry-over incomplete tasks from the most recent plan for this farm
  const carryOverTasks = selectedFarm
    ? existingPlans
        .filter((p) => p.farmId === selectedFarm.id)
        .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())[0]
        ?.tasks.filter((t) => !t.completed) ?? []
    : [];

  const categories = Object.keys(categoryMeta) as Array<keyof typeof categoryMeta>;
  const planCategories = categories.filter((cat) =>
    plan?.tasks.some((t) => t.category === cat),
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("resourcePlan")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lang === "ms"
            ? "Jana pelan tugas mingguan adaptif untuk ladang anda"
            : "Generate adaptive weekly task plans for your farm"}
        </p>
      </div>

      {/* Farm selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {lang === "ms" ? "Pilih Ladang" : "Select Farm"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {farms.length > 0 ? (
            <Select value={farmId} onValueChange={setFarmId}>
              <SelectTrigger data-testid="select-existing-farm">
                <SelectValue placeholder={t("selectFarm")} />
              </SelectTrigger>
              <SelectContent>
                {farms.map((farm) => (
                  <SelectItem key={farm.id} value={farm.id}>
                    {farm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              {lang === "ms"
                ? "Tambah ladang dahulu untuk menjana pelan."
                : "Add a farm first to generate a plan."}
            </p>
          )}

          {/* Farm context summary */}
          {selectedFarm && (
            <div className="rounded-lg border p-3 text-sm grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-3">
                <p className="text-muted-foreground text-xs">{lang === "ms" ? "Persekitaran" : "Environment"}</p>
                <p className="font-medium text-xs">{selectedFarm.environment}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("paddyAge")}</p>
                <p className="font-medium">
                  {selectedFarm.paddyAgeRange} {lang === "ms" ? "hari" : "days"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("growthPhase")}</p>
                <p className="font-medium capitalize">{t(selectedFarm.growthPhase as any)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t("farmSize")}</p>
                <p className="font-medium capitalize">{selectedFarm.farmSizeCategory}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-muted-foreground text-xs">{t("temperature")}:</span>
                <span className="font-medium text-xs">{selectedFarm.mockWeather.temperature}°C</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-muted-foreground text-xs">{t("rainfall")}:</span>
                <span className="font-medium text-xs">{selectedFarm.mockWeather.rainfall} mm</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-muted-foreground text-xs">{t("windSpeed")}:</span>
                <span className="font-medium text-xs">{selectedFarm.mockWeather.windSpeed} km/h</span>
              </div>
            </div>
          )}

          {/* Carry-over warning */}
          {carryOverTasks.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                {lang === "ms"
                  ? `${carryOverTasks.length} tugas belum selesai dari minggu lepas akan dimasukkan ke dalam pelan baharu.`
                  : `${carryOverTasks.length} incomplete task(s) from last week will be carried into the new plan.`}
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          <Button
            type="button"
            className="w-full gap-2"
            disabled={!selectedFarm || isPending}
            onClick={onGenerate}
            data-testid="button-get-plan"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {lang === "ms" ? "Menjana pelan..." : "Generating plan..."}
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4" />
                {t("getPlan")}
              </>
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* AI Insight card — shown when a farm is selected */}
      {selectedFarm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {lang === "ms" ? "Pandangan AI untuk Ladang Ini" : "AI Insight for This Farm"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isInsightLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : insight ? (
              <p className="text-sm text-foreground leading-relaxed">{insight}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {lang === "ms" ? "Tiada pandangan tersedia." : "No insight available."}
              </p>
            )}
            {!isInsightLoading && insight && (
              <button
                onClick={() => {
                  setInsight("");
                  setIsInsightLoading(true);
                  const farmPlans = existingPlans.filter((p) => p.farmId === selectedFarm.id);
                  const pendingCount = farmPlans.flatMap((p) => p.tasks).filter((t) => !t.completed).length;
                  const recentDiseases: RecentDiseaseRef[] = detections
                    .filter((d) => d.farmId === selectedFarm.id)
                    .slice(0, 3)
                    .map((d) => ({ diseaseNameEn: d.diseaseNameEn, severity: d.severity, detectedAt: d.detectedAt }));
                  fetchResourceInsights(selectedFarm, pendingCount, recentDiseases, lang)
                    .then(setInsight)
                    .finally(() => setIsInsightLoading(false));
                }}
                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                {lang === "ms" ? "Muat semula pandangan" : "Refresh insight"}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generated plan result */}
      {plan && (
        <div className="space-y-4" data-testid="resource-plan-result">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <p className="text-sm font-medium text-foreground">
                {lang === "ms"
                  ? "Pelan mingguan telah disimpan ke Firestore. Tugas belum selesai akan mempengaruhi pelan minggu seterusnya."
                  : "The weekly plan was saved to Firestore. Incomplete tasks will influence next week's plan."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ms" ? "Minggu bermula" : "Week starting"}:{" "}
                {new Date(plan.weekStart).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}
                {" · "}
                {plan.tasks.length} {lang === "ms" ? "tugas dijana" : "tasks generated"}
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            {planCategories.map((cat) => {
              const meta = categoryMeta[cat];
              return (
                <Card key={cat} className={`border ${meta.color}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {meta.icon}
                      {meta.label[lang]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TaskList plan={plan} category={cat} lang={lang} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskList({ plan, category, lang }: { plan: WeeklyTaskPlan; category: string; lang: string }) {
  const tasks = plan.tasks.filter((task) => task.category === category);
  if (tasks.length === 0) return <p className="text-sm text-muted-foreground">-</p>;
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0"
        >
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{(lang === "ms" ? task.titleMs : task.titleEn) || task.title}</p>
              <p className="text-xs text-muted-foreground">{(lang === "ms" ? task.descriptionMs : task.descriptionEn) || task.description}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {new Date(task.dueDate).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}
            </p>
            <Badge className={`text-xs mt-1 ${priorityColors[task.priority] || ""}`}>
              {task.priority}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
