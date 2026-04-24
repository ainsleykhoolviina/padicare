import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { deleteTaskPlan, updateTaskCompletion, useFarms, useTaskPlans } from "@/services/firestoreService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, CheckCircle, Clock, AlertCircle, CalendarDays } from "lucide-react";

const priorityColors: Record<string, string> = { low: "bg-slate-100 text-slate-700", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
const categoryColors: Record<string, string> = { fertilizer: "bg-green-100 text-green-700", pesticide: "bg-amber-100 text-amber-700", irrigation: "bg-blue-100 text-blue-700", monitoring: "bg-slate-100 text-slate-700", disease_follow_up: "bg-red-100 text-red-700" };

export default function TasksPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [farmFilter, setFarmFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const { data: farms } = useFarms(user?.id);
  const { data: plans, isLoading } = useTaskPlans(user?.id);

  const filteredPlans = plans.map((plan) => ({ ...plan, tasks: plan.tasks.filter((task) => (farmFilter === "all" || plan.farmId === farmFilter) && (statusFilter === "all" || (statusFilter === "done" ? task.completed : !task.completed))) })).filter((plan) => plan.tasks.length > 0);

  const toggleTask = async (planId: string, taskId: string, checked: boolean) => {
    if (!user) return;
    const plan = plans.find((item) => item.id === planId);
    if (plan) await updateTaskCompletion(user.id, plan, taskId, checked);
  };

  const removePlan = async (planId: string) => {
    if (!user) return;
    await deleteTaskPlan(user.id, planId);
  };

  const completed = plans.flatMap((plan) => plan.tasks).filter((task) => task.completed).length;
  const total = plans.flatMap((plan) => plan.tasks).length;

  return <div className="space-y-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-foreground">{t("tasks")}</h1><p className="text-muted-foreground text-sm mt-1">{lang === "ms" ? "Pelan tugas mingguan daripada Firestore" : "Weekly task plans from Firestore"}</p></div><Badge className="bg-primary/10 text-primary">{completed}/{total} {lang === "ms" ? "siap" : "done"}</Badge></div><Card className="border-primary/20"><CardContent className="py-4"><div className="flex items-start gap-3"><CalendarDays className="w-5 h-5 text-primary mt-0.5" /><div><p className="text-sm font-semibold">{lang === "ms" ? "Perancangan minggu seterusnya menyesuaikan tugasan yang belum selesai." : "Next week planning adjusts to incomplete tasks."}</p><p className="text-xs text-muted-foreground mt-1">{lang === "ms" ? "Jana pelan baharu di halaman Resource Planning atau hasil imbasan penyakit." : "Generate new plans from Resource Planning or disease scan results."}</p></div></div></CardContent></Card><div className="flex flex-wrap gap-3"><Select value={farmFilter} onValueChange={setFarmFilter}><SelectTrigger className="w-48" data-testid="select-farm-filter"><SelectValue placeholder={t("filterByFarm")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allFarms")}</SelectItem>{farms.map((farm) => <SelectItem key={farm.id} value={farm.id}>{farm.name}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "pending" | "done")}><SelectTrigger className="w-48" data-testid="select-status-filter"><SelectValue placeholder={t("filterByStatus")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("allStatuses")}</SelectItem><SelectItem value="pending">{t("pending")}</SelectItem><SelectItem value="done">{t("done")}</SelectItem></SelectContent></Select></div>{isLoading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div> : filteredPlans.length === 0 ? <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">{t("noTasks")}</p></CardContent></Card> : <div className="space-y-4">{filteredPlans.map((plan) => <Card key={plan.id} data-testid={`task-plan-${plan.id}`}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{plan.farmName}</CardTitle><p className="text-xs text-muted-foreground">{lang === "ms" ? "Minggu" : "Week"}: {new Date(plan.weekStart).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{plan.source.replace(/_/g, " ")}</Badge><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removePlan(plan.id)}><Trash2 className="w-4 h-4" /></Button></div></div></CardHeader><CardContent className="space-y-2">{plan.tasks.map((task) => { const Icon = task.completed ? CheckCircle : task.priority === "high" ? AlertCircle : Clock; return <div key={task.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${task.completed ? "opacity-60" : ""}`} data-testid={`task-card-${task.id}`}><div className="flex items-start gap-3 flex-1"><Checkbox checked={task.completed} onCheckedChange={(checked) => toggleTask(plan.id, task.id, Boolean(checked))} data-testid={`checkbox-task-${task.id}`} /><div className="flex-1 min-w-0"><p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{(lang === "ms" ? task.titleMs : task.titleEn) || task.title}</p><p className="text-xs text-muted-foreground mt-0.5">{(lang === "ms" ? task.descriptionMs : task.descriptionEn) || task.description}</p><div className="flex flex-wrap items-center gap-1.5 mt-1.5"><Badge className={`text-xs ${categoryColors[task.category] || "bg-gray-100 text-gray-700"}`}>{task.category.replace(/_/g, " ")}</Badge><Badge className={`text-xs ${priorityColors[task.priority] || ""}`}>{t(task.priority)}</Badge><span className="text-xs text-muted-foreground">{new Date(task.dueDate).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}</span></div></div></div><Icon className={`w-5 h-5 ${task.completed ? "text-green-600" : task.priority === "high" ? "text-red-600" : "text-gray-400"}`} /></div>; })}</CardContent></Card>)}</div>}</div>;
}
