import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDiseaseDetections, useFarms, useTaskPlans } from "@/services/firestoreService";
import { weatherWarnings } from "@/lib/mockWeather";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Leaf, ListTodo, ScanLine, BarChart3, CloudSun, AlertTriangle, TrendingUp } from "lucide-react";

const phaseColors: Record<string, string> = {
  nursery: "bg-blue-100 text-blue-700",
  vegetative: "bg-green-100 text-green-700",
  reproductive: "bg-amber-100 text-amber-700",
  ripening: "bg-orange-100 text-orange-700",
  harvested: "bg-gray-100 text-gray-700",
};

const phaseOrder = ["nursery", "vegetative", "reproductive", "ripening", "harvested"];
const sizeValue = { small: 0.8, medium: 2.5, large: 6 };

export default function DashboardPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { data: farms, isLoading: farmsLoading } = useFarms(user?.id);
  const { data: detections, isLoading: detectionsLoading } = useDiseaseDetections(user?.id);
  const { data: plans, isLoading: plansLoading } = useTaskPlans(user?.id);

  const isLoading = farmsLoading || detectionsLoading || plansLoading;
  const allTasks = plans.flatMap((plan) => plan.tasks.map((task) => ({ ...task, farmName: plan.farmName })));
  const pendingTasks = allTasks.filter((task) => !task.completed);
  const firstWarning = farms.flatMap((farm) => weatherWarnings(farm.mockWeather))[0];

  const severityColor = (severity: string) => {
    if (severity === "ringan") return "bg-green-100 text-green-800 border-green-300";
    if (severity === "sedang") return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {lang === "ms" ? `Selamat datang, ${user?.name}` : `Welcome, ${user?.name}`}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("tagline")}</p>
      </div>

      {firstWarning && (
        <Alert className="border-amber-400 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>{lang === "ms" ? "Amaran Cuaca: " : "Weather Warning: "}</strong>
            {lang === "ms" ? firstWarning.messageMs : firstWarning.messageEn}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="stat-total-farms"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center"><Leaf className="w-5 h-5 text-primary" /></div><div><p className="text-2xl font-bold text-foreground">{farms.length}</p><p className="text-xs text-muted-foreground">{t("totalFarms")}</p></div></div></CardContent></Card>
          <Card data-testid="stat-total-hectares"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center"><TrendingUp className="w-5 h-5 text-secondary" /></div><div><p className="text-2xl font-bold text-foreground">{farms.reduce((sum, farm) => sum + sizeValue[farm.farmSizeCategory], 0).toFixed(1)}</p><p className="text-xs text-muted-foreground">{t("totalHectares")}</p></div></div></CardContent></Card>
          <Card data-testid="stat-pending-tasks"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><ListTodo className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold text-foreground">{pendingTasks.length}</p><p className="text-xs text-muted-foreground">{t("pendingTasks")}</p></div></div></CardContent></Card>
          <Card data-testid="stat-recent-detections"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center"><ScanLine className="w-5 h-5 text-rose-600" /></div><div><p className="text-2xl font-bold text-foreground">{detections.length}</p><p className="text-xs text-muted-foreground">{t("recentDetections")}</p></div></div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{t("quickActions")}</CardTitle></CardHeader>
        <CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/disease"><Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1.5" data-testid="quick-action-scan"><ScanLine className="w-5 h-5 text-primary" /><span className="text-xs">{t("scanNow")}</span></Button></Link>
          <Link href="/farms"><Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1.5" data-testid="quick-action-farms"><Leaf className="w-5 h-5 text-primary" /><span className="text-xs">{t("viewFarms")}</span></Button></Link>
          <Link href="/weather"><Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1.5" data-testid="quick-action-weather"><CloudSun className="w-5 h-5 text-primary" /><span className="text-xs">{t("checkWeather")}</span></Button></Link>
          <Link href="/resources"><Button variant="outline" className="w-full h-auto py-3 flex flex-col gap-1.5" data-testid="quick-action-resources"><BarChart3 className="w-5 h-5 text-primary" /><span className="text-xs">{t("planResources")}</span></Button></Link>
        </div></CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{lang === "ms" ? "Ladang Saya" : "My Farms"}</CardTitle><Link href="/farms"><Button variant="ghost" size="sm" className="text-xs text-primary">{t("viewFarms")}</Button></Link></div></CardHeader>
          <CardContent>{farms.length > 0 ? <div className="space-y-3">{farms.slice(0, 4).map((farm) => { const progress = ((phaseOrder.indexOf(farm.growthPhase) + 1) / phaseOrder.length) * 100; return <Link key={farm.id} href={`/farms/${farm.id}`}><div className="flex items-center justify-between py-2 border-b border-border last:border-0 cursor-pointer hover:opacity-80 transition-opacity" data-testid={`farm-overview-${farm.id}`}><div><p className="text-sm font-medium text-foreground">{farm.name}</p><p className="text-xs text-muted-foreground">{farmSizeText(farm.farmSizeCategory, lang)} • {farm.paddyType}</p></div><div className="text-right"><Badge className={`text-xs ${phaseColors[farm.growthPhase] || "bg-gray-100"}`}>{t(farm.growthPhase)}</Badge><div className="w-16 bg-muted rounded-full h-1.5 mt-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${progress}%` }} /></div></div></div></Link>; })}</div> : <div className="text-center py-4"><p className="text-sm text-muted-foreground mb-3">{t("noFarms")}</p><Link href="/farms/new"><Button size="sm" className="gap-1.5"><Leaf className="w-3.5 h-3.5" />{t("addFarm")}</Button></Link></div>}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{t("recentDetections")}</CardTitle><Link href="/disease"><Button variant="ghost" size="sm" className="text-xs text-primary">{t("scanNow")}</Button></Link></div></CardHeader>
          <CardContent>{detections.length > 0 ? <div className="space-y-2">{detections.slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0" data-testid={`detection-item-${item.id}`}><div><p className="text-sm font-medium text-foreground truncate max-w-[140px]">{lang === "ms" ? item.diseaseNameMs : item.diseaseNameEn}</p><p className="text-xs text-muted-foreground">{new Date(item.detectedAt).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}</p></div><Badge className={`text-xs border ${severityColor(item.severity)}`}>{t(item.severity)}</Badge></div>)}</div> : <div className="text-center py-4"><p className="text-sm text-muted-foreground mb-3">{t("noHistory")}</p><Link href="/disease"><Button size="sm" variant="outline" className="gap-1.5"><ScanLine className="w-3.5 h-3.5" />{t("detectDisease")}</Button></Link></div>}</CardContent>
        </Card>
      </div>

      {pendingTasks.length > 0 && <Card><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{lang === "ms" ? "Tugas Akan Datang" : "Upcoming Tasks"}</CardTitle><Link href="/tasks"><Button variant="ghost" size="sm" className="text-xs text-primary">{t("tasks")}</Button></Link></div></CardHeader><CardContent><div className="space-y-2">{pendingTasks.slice(0, 5).map((task) => <div key={task.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`upcoming-task-${task.id}`}><p className="text-sm text-foreground">{(lang === "ms" ? task.titleMs : task.titleEn) || task.title}</p><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{new Date(task.dueDate).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}</span><Badge className={`text-xs ${task.priority === "high" ? "bg-red-100 text-red-700" : task.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{t(task.priority)}</Badge></div></div>)}</div></CardContent></Card>}
    </div>
  );
}

function farmSizeText(size: string, lang: string) {
  if (lang === "ms") return size === "small" ? "Kecil" : size === "medium" ? "Sederhana" : "Besar";
  return size.charAt(0).toUpperCase() + size.slice(1);
}
